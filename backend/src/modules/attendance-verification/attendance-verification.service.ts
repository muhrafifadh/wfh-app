import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Paginated } from "@/common/dto/pagination.js";
import { ForbiddenError, NotFoundError } from "@/common/errors/app-error.js";
import { fromDateColumn, toDateColumn } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import { Clock } from "@/infra/clock/clock.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { SIGNED_URL_TTL_SECONDS, StorageService } from "@/infra/storage/storage.service.js";
import {
  CLOSED_ITEM_RETENTION_MS,
  DEFAULT_RADIUS_METERS,
  MIN_JUSTIFICATION_LENGTH,
  NOTICE_VERSION,
  PENDING_PHOTO_TTL_MS,
  PHOTO_EXTENSIONS,
  PHOTO_RETENTION_MS,
  RESULT_RETENTION_MS,
  WORK_LOCATION_DECIMALS,
} from "@/modules/attendance-verification/attendance-verification.constants.js";
import {
  PhotoNotAvailableError,
  PhotoRequestAlreadyDecidedError,
  VerificationAlreadyRecordedError,
  VerificationDisabledError,
  VerificationJustificationRequiredError,
  VerificationNotAvailableError,
  VerificationNoticeRequiredError,
  VerificationWindowClosedError,
  WorkLocationAlreadyDecidedError,
} from "@/modules/attendance-verification/attendance-verification.errors.js";
import {
  VERIFICATION_EVENTS,
  VerificationEvent,
  type VerificationEventName,
} from "@/modules/attendance-verification/attendance-verification.events.js";
import {
  AttendanceVerificationRepository,
  type PhotoRequestRow,
  type VerificationRow,
  type WorkLocationRow,
} from "@/modules/attendance-verification/attendance-verification.repository.js";
import {
  isFlagged,
  locationOutcome,
  locationSubmission,
  roundCoordinate,
  withinCaptureWindow,
} from "@/modules/attendance-verification/domain/verification-rules.js";
import type {
  ApproveWorkLocationInput,
  CreateSelfieUploadInput,
  DisclosePhotoInput,
  ListVerificationsQueryInput,
  RequestPhotoInput,
  RequestWorkLocationInput,
  SubmitLocationInput,
  UpdateVerificationSettingsInput,
} from "@/modules/attendance-verification/dto/verification.dto.js";
import type {
  MyResultBody,
  MyVerificationBody,
  PhotoRequestBody,
  SelfieUploadBody,
  SignedPhotoBody,
  VerificationItemBody,
  VerificationSettingsBody,
  WorkLocationRequestBody,
} from "@/modules/attendance-verification/dto/verification.response.js";
import { NotCheckedInError } from "@/modules/attendance/attendance.errors.js";
import { AttendanceService } from "@/modules/attendance/attendance.service.js";
import { EmployeeProfileRequiredError } from "@/modules/employees/employees.errors.js";
import { EmployeesService, type EmployeeProfile } from "@/modules/employees/employees.service.js";
import { matchesContentType, SIGNATURE_BYTES } from "@/modules/uploads/file-signature.js";
import { UploadMismatchError, UploadNotReceivedError } from "@/modules/uploads/uploads.errors.js";

const CLEANUP_BATCH = 500;
const MY_RESULTS_LIMIT = 100;

const toWorkLocation = (row: WorkLocationRow): WorkLocationRequestBody => ({
  id: row.id,
  label: row.label,
  latitude: row.latitude,
  longitude: row.longitude,
  radiusMeters: row.radiusMeters,
  status: row.status,
  requestedAt: row.createdAt.toISOString(),
  employee: row.employee,
});

const toPhotoRequest = (row: PhotoRequestRow): PhotoRequestBody => ({
  id: row.id,
  verificationId: row.verificationId,
  workDate: fromDateColumn(row.workDate),
  status: row.status,
  requestedAt: row.createdAt.toISOString(),
  employee: row.employee,
});

/**
 * ATTENDANCE_VERIFICATION_PLAN.md — optional evidence at check-in, kept apart from
 * attendance. Nothing here can block or change an attendance record: the check-in is
 * recorded first, and everything else follows it.
 */
@Injectable()
export class AttendanceVerificationService {
  constructor(
    private readonly repo: AttendanceVerificationRepository,
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
    private readonly storage: StorageService,
    private readonly config: AppConfig,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  // Settings

  async settings(user: AuthUser): Promise<VerificationSettingsBody> {
    return this.effectiveSettings(user.organizationId);
  }

  async updateSettings(
    user: AuthUser,
    input: UpdateVerificationSettingsInput,
  ): Promise<VerificationSettingsBody> {
    const before = await this.repo.settingsOf(user.organizationId);
    const turningOn =
      (input.locationEnabled && !before.locationVerificationEnabled) ||
      (input.selfieEnabled && !before.selfieVerificationEnabled);
    if (turningOn) {
      if (!this.available) throw new VerificationNotAvailableError();
      if ((input.justification?.length ?? 0) < MIN_JUSTIFICATION_LENGTH) {
        throw new VerificationJustificationRequiredError();
      }
    }
    const after = await this.repo.updateSettings(user.organizationId, {
      locationVerificationEnabled: input.locationEnabled,
      selfieVerificationEnabled: input.selfieEnabled,
    });
    await this.emit(
      VERIFICATION_EVENTS.settingsChanged,
      user,
      "organization",
      user.organizationId,
      {
        location: {
          from: before.locationVerificationEnabled,
          to: after.locationVerificationEnabled,
        },
        selfie: { from: before.selfieVerificationEnabled, to: after.selfieVerificationEnabled },
        ...(turningOn && { justification: input.justification }),
      },
    );
    return this.effectiveSettings(user.organizationId);
  }

  // The employee's view

  async mine(user: AuthUser): Promise<MyVerificationBody> {
    const settings = await this.effectiveSettings(user.organizationId);
    const employee = await this.employees.findProfileForUser(user.organizationId, user.id);
    const off: MyVerificationBody = {
      location: { enabled: false, result: null, canSubmit: false },
      selfie: { enabled: false, result: null, canSubmit: false },
      notice: { version: NOTICE_VERSION, acknowledged: false },
      workLocation: { approved: null, pending: null },
    };
    if (!employee || (!settings.locationEnabled && !settings.selfieEnabled)) return off;

    const now = this.clock.now();
    const [acknowledged, locations, checkIn] = await Promise.all([
      this.repo.hasAcknowledged(employee.id, NOTICE_VERSION),
      this.repo.findWorkLocations(employee.id),
      this.checkInToday(user),
    ]);
    const approved = locations.find((row) => row.status === "approved") ?? null;
    const pending = locations.find((row) => row.status === "pending") ?? null;
    const rows = checkIn ? await this.repo.findForAttendance(checkIn.id) : [];
    const location = rows.find((row) => row.method === "location") ?? null;
    const selfie = rows.find((row) => row.method === "selfie") ?? null;

    return {
      location: {
        enabled: settings.locationEnabled,
        result: location?.result ?? null,
        canSubmit:
          settings.locationEnabled &&
          approved !== null &&
          checkIn !== null &&
          location !== null &&
          locationSubmission(location.result, checkIn.checkInAt, now) === "allowed",
      },
      selfie: {
        enabled: settings.selfieEnabled,
        result: selfie?.result ?? null,
        canSubmit:
          settings.selfieEnabled &&
          checkIn !== null &&
          selfie !== null &&
          selfie.result !== "captured" &&
          withinCaptureWindow(checkIn.checkInAt, now),
      },
      notice: { version: NOTICE_VERSION, acknowledged },
      workLocation: {
        approved: approved && { label: approved.label, radiusMeters: approved.radiusMeters },
        pending: pending && { label: pending.label },
      },
    };
  }

  async myResults(user: AuthUser): Promise<{ items: MyResultBody[] }> {
    const employee = await this.requireProfile(user);
    const rows = await this.repo.listOwn(user.organizationId, employee.id, MY_RESULTS_LIMIT);
    return {
      items: rows.map((row) => ({
        id: row.id,
        workDate: fromDateColumn(row.workDate),
        method: row.method,
        result: row.result,
        photoAvailable: row.photoKey !== null,
        photoRequest: row.photoRequests[0]?.status ?? null,
      })),
    };
  }

  async acknowledgeNotice(user: AuthUser): Promise<void> {
    const employee = await this.requireProfile(user);
    await this.repo.acknowledge({
      organizationId: user.organizationId,
      employeeId: employee.id,
      noticeVersion: NOTICE_VERSION,
      acknowledgedAt: this.clock.now(),
    });
    await this.emit(VERIFICATION_EVENTS.noticeAcknowledged, user, "employee", employee.id, {
      noticeVersion: NOTICE_VERSION,
    });
  }

  /**
   * After a check-in commits: one result per method that's on, "not shared" until the
   * employee shares something. Without an approved area there is nothing to compare,
   * so location is never requested.
   */
  async recordCheckIn(organizationId: string, attendanceId: string): Promise<void> {
    const settings = await this.effectiveSettings(organizationId);
    if (!settings.locationEnabled && !settings.selfieEnabled) return;
    const attendance = await this.attendance.findForCorrection(organizationId, attendanceId);
    if (!attendance) return;
    const locations = await this.repo.findWorkLocations(attendance.employeeId);
    const hasArea = locations.some((row) => row.status === "approved");
    const base = {
      organizationId,
      attendanceId,
      employeeId: attendance.employeeId,
      workDate: toDateColumn(attendance.workDate),
      deleteAfter: new Date(this.clock.now().getTime() + RESULT_RETENTION_MS),
    };
    await this.repo.createResults([
      ...(settings.locationEnabled
        ? [
            {
              ...base,
              method: "location" as const,
              result: hasArea ? ("not_shared" as const) : ("no_approved_area" as const),
            },
          ]
        : []),
      ...(settings.selfieEnabled
        ? [{ ...base, method: "selfie" as const, result: "not_shared" as const }]
        : []),
    ]);
  }

  // Location (Phase 7A)

  async submitLocation(user: AuthUser, input: SubmitLocationInput): Promise<MyVerificationBody> {
    const { employee, checkIn } = await this.readyToCapture(user, "locationEnabled");
    const row = await this.resultFor(user, checkIn.id, "location");
    const now = this.clock.now();

    const locations = await this.repo.findWorkLocations(employee.id);
    const area = locations.find((location) => location.status === "approved");
    // Nothing to compare with: the coordinates are dropped and the result stays
    if (!area) return this.mine(user);

    const submission = locationSubmission(row.result, checkIn.checkInAt, now);
    if (submission === "already_recorded") throw new VerificationAlreadyRecordedError();
    if (submission === "window_closed") throw new VerificationWindowClosedError();

    // The coordinates end here (decision V3): only the outcome is stored
    const outcome = locationOutcome(input, area);
    await this.repo.updateResult(row.id, {
      result: outcome.result,
      distanceBand: outcome.distanceBand,
      accuracyMeters: Math.round(input.accuracyMeters),
      capturedAt: now,
    });
    return this.mine(user);
  }

  async requestWorkLocation(
    user: AuthUser,
    input: RequestWorkLocationInput,
  ): Promise<MyVerificationBody> {
    const settings = await this.effectiveSettings(user.organizationId);
    if (!settings.locationEnabled) throw new VerificationDisabledError();
    const employee = await this.requireProfile(user);
    await this.requireNotice(employee);
    const created = await this.prisma.$transaction((tx) =>
      this.repo.requestWorkLocation(
        {
          organizationId: user.organizationId,
          employeeId: employee.id,
          label: input.label,
          latitude: roundCoordinate(input.latitude, WORK_LOCATION_DECIMALS),
          longitude: roundCoordinate(input.longitude, WORK_LOCATION_DECIMALS),
          radiusMeters: DEFAULT_RADIUS_METERS,
        },
        tx,
      ),
    );
    await this.emit(VERIFICATION_EVENTS.workLocationRequested, user, "work_location", created.id, {
      employeeId: employee.id,
    });
    return this.mine(user);
  }

  async listWorkLocationRequests(user: AuthUser): Promise<{ items: WorkLocationRequestBody[] }> {
    const rows = await this.repo.listPendingWorkLocations(user.organizationId);
    return { items: rows.map(toWorkLocation) };
  }

  async approveWorkLocation(
    user: AuthUser,
    id: string,
    input: ApproveWorkLocationInput,
  ): Promise<WorkLocationRequestBody> {
    const row = await this.loadWorkLocation(user, id);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      // Older area first: only one can be approved at a time
      await this.repo.supersedeApproved(row.employeeId, now, tx);
      const decided = await this.repo.decideWorkLocation(
        id,
        {
          status: "approved",
          decidedAt: now,
          ...(input.radiusMeters !== undefined && { radiusMeters: input.radiusMeters }),
        },
        tx,
      );
      // Rolls back the line above too
      if (!decided) throw new WorkLocationAlreadyDecidedError();
    });
    await this.emit(VERIFICATION_EVENTS.workLocationApproved, user, "work_location", id, {
      employeeId: row.employeeId,
    });
    return toWorkLocation(await this.loadWorkLocation(user, id));
  }

  async rejectWorkLocation(user: AuthUser, id: string): Promise<WorkLocationRequestBody> {
    const row = await this.loadWorkLocation(user, id);
    const decided = await this.repo.decideWorkLocation(id, {
      status: "rejected",
      decidedAt: this.clock.now(),
    });
    if (!decided) throw new WorkLocationAlreadyDecidedError();
    await this.emit(VERIFICATION_EVENTS.workLocationRejected, user, "work_location", id, {
      employeeId: row.employeeId,
    });
    return toWorkLocation(await this.loadWorkLocation(user, id));
  }

  // Selfie (Phase 7B)

  async createSelfieUpload(
    user: AuthUser,
    input: CreateSelfieUploadInput,
  ): Promise<SelfieUploadBody> {
    const { checkIn } = await this.readyToCapture(user, "selfieEnabled");
    const row = await this.resultFor(user, checkIn.id, "selfie");
    const now = this.clock.now();
    if (row.result === "captured") throw new VerificationAlreadyRecordedError();
    if (!withinCaptureWindow(checkIn.checkInAt, now)) throw new VerificationWindowClosedError();

    // A retake replaces the upload in progress
    if (row.pendingPhotoKey) await this.storage.delete(row.pendingPhotoKey);
    const key = `verification-selfies/${user.organizationId}/${randomUUID()}${PHOTO_EXTENSIONS[input.contentType]}`;
    await this.repo.updateResult(row.id, {
      pendingPhotoKey: key,
      pendingPhotoContentType: input.contentType,
      pendingPhotoSize: input.size,
      pendingPhotoExpiresAt: new Date(now.getTime() + PENDING_PHOTO_TTL_MS),
    });
    return {
      uploadUrl: await this.storage.signUpload(key, input.contentType, input.size),
      uploadHeaders: { "Content-Type": input.contentType },
      expiresAt: new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /** After the PUT: check what arrived, then keep it for 30 days at most. */
  async completeSelfie(user: AuthUser): Promise<MyVerificationBody> {
    const { checkIn } = await this.readyToCapture(user, "selfieEnabled");
    const row = await this.resultFor(user, checkIn.id, "selfie");
    if (row.result === "captured") throw new VerificationAlreadyRecordedError();
    if (!row.pendingPhotoKey || !row.pendingPhotoContentType) throw new UploadNotReceivedError();

    const stored = await this.storage.head(row.pendingPhotoKey);
    if (!stored) throw new UploadNotReceivedError();
    const start = await this.storage.readStart(row.pendingPhotoKey, SIGNATURE_BYTES);
    const contentType = row.pendingPhotoContentType === "image/webp" ? "image/webp" : "image/jpeg";
    if (stored.size !== row.pendingPhotoSize || !matchesContentType(start, contentType)) {
      await this.storage.delete(row.pendingPhotoKey);
      await this.repo.updateResult(row.id, {
        pendingPhotoKey: null,
        pendingPhotoContentType: null,
        pendingPhotoSize: null,
        pendingPhotoExpiresAt: null,
      });
      throw new UploadMismatchError();
    }

    const now = this.clock.now();
    await this.repo.updateResult(row.id, {
      result: "captured",
      photoKey: row.pendingPhotoKey,
      photoDeleteAfter: new Date(now.getTime() + PHOTO_RETENTION_MS),
      capturedAt: now,
      pendingPhotoKey: null,
      pendingPhotoContentType: null,
      pendingPhotoSize: null,
      pendingPhotoExpiresAt: null,
    });
    return this.mine(user);
  }

  // Review

  /** Organization for attendance:read_all, direct reports for attendance:read_team. */
  async list(
    user: AuthUser,
    query: ListVerificationsQueryInput,
  ): Promise<Paginated<VerificationItemBody>> {
    let employeeIds: string[] | undefined;
    if (!user.permissions.includes("attendance:read_all")) {
      if (!user.permissions.includes("attendance:read_team")) throw new ForbiddenError();
      const team = await this.employees.teamOf(user.organizationId, user.id);
      employeeIds = team?.employeeIds ?? [];
    }
    const { rows, total } = await this.repo.list(user.organizationId, {
      ...query,
      ...(employeeIds && { employeeIds }),
    });
    return {
      items: rows.map((row) => this.toItem(user, row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async review(user: AuthUser, id: string): Promise<VerificationItemBody> {
    const row = await this.loadResult(user, id);
    const updated = row.reviewedAt
      ? row
      : await this.repo.updateResult(id, { reviewedAt: this.clock.now() });
    if (!row.reviewedAt) {
      await this.emit(VERIFICATION_EVENTS.reviewed, user, "attendance_verification", id, {
        employeeId: row.employeeId,
        workDate: fromDateColumn(row.workDate),
      });
    }
    return this.toItem(user, updated);
  }

  /** Decision V9: every access is audited, before the link is handed over. */
  async viewPhoto(user: AuthUser, id: string): Promise<SignedPhotoBody> {
    const row = await this.loadResult(user, id);
    if (!row.photoKey) throw new NotFoundError("Photo");
    await this.emit(VERIFICATION_EVENTS.photoViewed, user, "attendance_verification", id, {
      employeeId: row.employeeId,
      workDate: fromDateColumn(row.workDate),
    });
    return this.signPhoto(row.photoKey, fromDateColumn(row.workDate));
  }

  // The employee's photo access (decision V12)

  async requestPhoto(user: AuthUser, input: RequestPhotoInput): Promise<PhotoRequestBody> {
    const employee = await this.requireProfile(user);
    const row = await this.repo.findInOrganization(user.organizationId, input.verificationId);
    if (!row || row.employeeId !== employee.id) throw new NotFoundError("Verification");
    if (!row.photoKey) throw new PhotoNotAvailableError();

    const open = await this.repo.findOpenPhotoRequest(row.id);
    if (open) return toPhotoRequest(open);
    const created = await this.repo.createPhotoRequest({
      organizationId: user.organizationId,
      employeeId: employee.id,
      verificationId: row.id,
      workDate: row.workDate,
    });
    await this.emit(VERIFICATION_EVENTS.photoRequested, user, "photo_request", created.id, {
      employeeId: employee.id,
    });
    return toPhotoRequest(created);
  }

  async listPhotoRequests(user: AuthUser): Promise<{ items: PhotoRequestBody[] }> {
    const rows = await this.repo.listOpenPhotoRequests(user.organizationId);
    return { items: rows.map(toPhotoRequest) };
  }

  async disclosePhoto(
    user: AuthUser,
    id: string,
    input: DisclosePhotoInput,
  ): Promise<SignedPhotoBody> {
    const request = await this.loadPhotoRequest(user, id);
    const key = request.verification?.photoKey;
    if (!key) throw new PhotoNotAvailableError();
    const decided = await this.repo.decidePhotoRequest(id, {
      status: "disclosed",
      decidedAt: this.clock.now(),
      identityCheck: input.identityCheck,
    });
    if (!decided) throw new PhotoRequestAlreadyDecidedError();
    await this.emit(VERIFICATION_EVENTS.photoDisclosed, user, "photo_request", id, {
      employeeId: request.employeeId,
      identityCheck: input.identityCheck,
    });
    return this.signPhoto(key, fromDateColumn(request.workDate));
  }

  async declinePhotoRequest(user: AuthUser, id: string): Promise<PhotoRequestBody> {
    const request = await this.loadPhotoRequest(user, id);
    const decided = await this.repo.decidePhotoRequest(id, {
      status: "declined",
      decidedAt: this.clock.now(),
    });
    if (!decided) throw new PhotoRequestAlreadyDecidedError();
    await this.emit(VERIFICATION_EVENTS.photoRequestDeclined, user, "photo_request", id, {
      employeeId: request.employeeId,
    });
    return toPhotoRequest(await this.loadPhotoRequest(user, id));
  }

  // Cleanup (decisions V3 and V8)

  /** Run by the scheduled job. Storage first: if it stops halfway, the rows are still there. */
  async purgeExpired(now = this.clock.now()) {
    const photos = await this.repo.findExpiredPhotos(now, CLEANUP_BATCH);
    for (const row of photos) {
      if (row.photoKey) await this.storage.delete(row.photoKey);
      await this.repo.clearPhoto(row.id);
    }
    const pending = await this.repo.findExpiredPendingPhotos(now, CLEANUP_BATCH);
    for (const row of pending) {
      if (row.pendingPhotoKey) await this.storage.delete(row.pendingPhotoKey);
      await this.repo.updateResult(row.id, {
        pendingPhotoKey: null,
        pendingPhotoContentType: null,
        pendingPhotoSize: null,
        pendingPhotoExpiresAt: null,
      });
    }
    const closedBefore = new Date(now.getTime() - CLOSED_ITEM_RETENTION_MS);
    return {
      photos: photos.length,
      pendingPhotos: pending.length,
      results: await this.repo.deleteExpiredResults(now),
      workLocations:
        (await this.repo.deleteClosedWorkLocations(closedBefore)) +
        (await this.repo.deleteWorkLocationsOfInactive()),
      photoRequests: await this.repo.deleteClosedPhotoRequests(closedBefore),
    };
  }

  // Helpers

  private get available(): boolean {
    return this.config.get("VERIFICATION_ENABLED");
  }

  /** The deployment switch wins over the organization's: off there means off everywhere. */
  private async effectiveSettings(organizationId: string): Promise<VerificationSettingsBody> {
    const stored = await this.repo.settingsOf(organizationId);
    return {
      available: this.available,
      locationEnabled: this.available && stored.locationVerificationEnabled,
      selfieEnabled: this.available && stored.selfieVerificationEnabled,
    };
  }

  private async requireProfile(user: AuthUser): Promise<EmployeeProfile> {
    const employee = await this.employees.findProfileForUser(user.organizationId, user.id);
    if (!employee) throw new EmployeeProfileRequiredError();
    return employee;
  }

  private async requireNotice(employee: EmployeeProfile): Promise<void> {
    if (!(await this.repo.hasAcknowledged(employee.id, NOTICE_VERSION))) {
      throw new VerificationNoticeRequiredError();
    }
  }

  private async checkInToday(user: AuthUser): Promise<{ id: string; checkInAt: Date } | null> {
    const { record } = await this.attendance.today(user);
    return record?.checkInAt ? { id: record.id, checkInAt: new Date(record.checkInAt) } : null;
  }

  /** The checks every capture shares: the method is on, the notice was seen, a check-in exists. */
  private async readyToCapture(
    user: AuthUser,
    method: "locationEnabled" | "selfieEnabled",
  ): Promise<{ employee: EmployeeProfile; checkIn: { id: string; checkInAt: Date } }> {
    const settings = await this.effectiveSettings(user.organizationId);
    if (!settings[method]) throw new VerificationDisabledError();
    const employee = await this.requireProfile(user);
    await this.requireNotice(employee);
    const checkIn = await this.checkInToday(user);
    if (!checkIn) throw new NotCheckedInError();
    return { employee, checkIn };
  }

  /** The row made at check-in. Made here if that listener failed, or the method was just turned on. */
  private async resultFor(
    user: AuthUser,
    attendanceId: string,
    method: "location" | "selfie",
  ): Promise<VerificationRow> {
    const existing = await this.repo.findResult(attendanceId, method);
    if (existing) return existing;
    await this.recordCheckIn(user.organizationId, attendanceId);
    const created = await this.repo.findResult(attendanceId, method);
    if (!created) throw new VerificationDisabledError();
    return created;
  }

  private toItem(user: AuthUser, row: VerificationRow): VerificationItemBody {
    const canDiagnose = user.permissions.includes("verification:manage");
    return {
      id: row.id,
      attendanceId: row.attendanceId,
      workDate: fromDateColumn(row.workDate),
      method: row.method,
      result: row.result,
      flagged: isFlagged(row.result) && !row.reviewedAt,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      employee: row.employee,
      diagnostics: canDiagnose
        ? { accuracyMeters: row.accuracyMeters, distanceBand: row.distanceBand }
        : null,
      photoAvailable: user.permissions.includes("verification:read_photo")
        ? row.photoKey !== null
        : null,
    };
  }

  private async signPhoto(key: string, workDate: string): Promise<SignedPhotoBody> {
    return {
      url: await this.storage.signDownload(
        key,
        `check-in-photo-${workDate}${key.slice(key.lastIndexOf("."))}`,
      ),
      expiresAt: new Date(this.clock.now().getTime() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  private async loadResult(user: AuthUser, id: string): Promise<VerificationRow> {
    const row = await this.repo.findInOrganization(user.organizationId, id);
    if (!row) throw new NotFoundError("Verification");
    return row;
  }

  private async loadWorkLocation(user: AuthUser, id: string): Promise<WorkLocationRow> {
    const row = await this.repo.findWorkLocation(user.organizationId, id);
    if (!row) throw new NotFoundError("Work location");
    return row;
  }

  private async loadPhotoRequest(user: AuthUser, id: string): Promise<PhotoRequestRow> {
    const row = await this.repo.findPhotoRequest(user.organizationId, id);
    if (!row) throw new NotFoundError("Photo request");
    return row;
  }

  private async emit(
    name: VerificationEventName,
    actor: AuthUser,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new VerificationEvent(name, actor.organizationId, actor.id, targetType, targetId, metadata),
    );
  }
}
