import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import {
  EmployeeDirectory,
  EmployeeProfileRequiredError,
  type EmployeeProfile,
} from "@/common/contracts/directory.js";
import type { Paginated } from "@/common/dto/pagination.js";
import { ForbiddenError, NotFoundError } from "@/common/errors/app-error.js";
import { matchesContentType, SIGNATURE_BYTES } from "@/common/files/file-signature.js";
import { UploadMismatchError, UploadNotReceivedError } from "@/common/files/upload.errors.js";
import { fromDateColumn, toDateColumn } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import { Clock } from "@/infra/clock/clock.js";
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
  VerificationDisabledError,
  VerificationJustificationRequiredError,
  VerificationLocationRequiredError,
  VerificationNotAvailableError,
  VerificationNoticeRequiredError,
  VerificationPhotoRequiredError,
  WorkLocationAlreadyDecidedError,
} from "@/modules/attendance-verification/attendance-verification.errors.js";
import {
  VERIFICATION_EVENTS,
  VerificationEvent,
  type VerificationEventName,
} from "@/modules/attendance-verification/attendance-verification.events.js";
import {
  AttendanceVerificationRepository,
  type OfficeRow,
  type PhotoRequestRow,
  type VerificationRow,
  type WorkLocationRow,
} from "@/modules/attendance-verification/attendance-verification.repository.js";
import {
  isFlagged,
  locationOutcome,
  roundCoordinate,
} from "@/modules/attendance-verification/domain/verification-rules.js";
import type {
  AddOfficeInput,
  ApproveWorkLocationInput,
  CreatePhotoUploadInput,
  DisclosePhotoInput,
  ListVerificationsQueryInput,
  RecordWithEvidenceInput,
  RequestPhotoInput,
  RequestWorkLocationInput,
  UpdateVerificationSettingsInput,
} from "@/modules/attendance-verification/dto/verification.dto.js";
import type {
  MyResultBody,
  MyVerificationBody,
  OfficeBody,
  PhotoRequestBody,
  PhotoUploadBody,
  SignedPhotoBody,
  VerificationItemBody,
  VerificationSettingsBody,
  WorkLocationRequestBody,
} from "@/modules/attendance-verification/dto/verification.response.js";
import { AttendanceService, type ActionResult } from "@/modules/attendance/attendance.service.js";

type Moment = "check_in" | "check_out";

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

const toOffice = (row: OfficeRow): OfficeBody => ({
  id: row.id,
  label: row.label,
  latitude: row.latitude,
  longitude: row.longitude,
  radiusMeters: row.radiusMeters,
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
 * ATTENDANCE_VERIFICATION_PLAN.md — the photo and location a check-in or check-out needs
 * while a method is on, kept apart from attendance. The evidence is checked first and the
 * attendance is recorded only if it passes. The result never changes that record.
 */
@Injectable()
export class AttendanceVerificationService {
  constructor(
    private readonly repo: AttendanceVerificationRepository,
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeeDirectory,
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
      location: { enabled: false },
      selfie: { enabled: false },
      results: [],
      notice: { version: NOTICE_VERSION, acknowledged: false },
      workLocation: { approved: null, pending: null },
      offices: [],
    };
    if (!employee || (!settings.locationEnabled && !settings.selfieEnabled)) return off;

    const [acknowledged, locations, offices, { record }] = await Promise.all([
      this.repo.hasAcknowledged(employee.id, NOTICE_VERSION),
      this.repo.findWorkLocations(employee.id),
      settings.locationEnabled ? this.repo.listOffices(user.organizationId) : [],
      this.attendance.today(user),
    ]);
    const approved = locations.find((row) => row.status === "approved") ?? null;
    const pending = locations.find((row) => row.status === "pending") ?? null;
    const rows = record ? await this.repo.findForAttendance(record.id) : [];

    return {
      location: { enabled: settings.locationEnabled },
      selfie: { enabled: settings.selfieEnabled },
      results: rows.map(({ moment, method, result }) => ({ moment, method, result })),
      notice: { version: NOTICE_VERSION, acknowledged },
      workLocation: {
        approved: approved && { label: approved.label, radiusMeters: approved.radiusMeters },
        pending: pending && { label: pending.label },
      },
      offices: offices.map(({ label }) => ({ label })),
    };
  }

  async myResults(user: AuthUser): Promise<{ items: MyResultBody[] }> {
    const employee = await this.requireProfile(user);
    const rows = await this.repo.listOwn(user.organizationId, employee.id, MY_RESULTS_LIMIT);
    return {
      items: rows.map((row) => ({
        id: row.id,
        workDate: fromDateColumn(row.workDate),
        moment: row.moment,
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

  // Check-in and check-out with evidence

  checkIn(user: AuthUser, key: string | undefined, input: RecordWithEvidenceInput) {
    return this.recordWithEvidence(user, "check_in", key, input);
  }

  checkOut(user: AuthUser, key: string | undefined, input: RecordWithEvidenceInput) {
    return this.recordWithEvidence(user, "check_out", key, input);
  }

  private async recordWithEvidence(
    user: AuthUser,
    moment: Moment,
    key: string | undefined,
    input: RecordWithEvidenceInput,
  ): Promise<ActionResult> {
    const settings = await this.effectiveSettings(user.organizationId);
    if (!settings.locationEnabled && !settings.selfieEnabled) throw new VerificationDisabledError();
    const employee = await this.requireProfile(user);
    await this.requireNotice(employee);

    const attend = () =>
      moment === "check_in"
        ? this.attendance.recordCheckIn(user, key)
        : this.attendance.recordCheckOut(user, key);

    // A retry after a lost response: the evidence is already in, so this replays the result
    const { record: today } = await this.attendance.today(user);
    const existing = today ? await this.repo.findForAttendance(today.id) : [];
    if (existing.some((row) => row.moment === moment)) return attend();

    const photo = settings.selfieEnabled ? await this.checkedPhoto(employee.id, moment) : null;
    if (settings.locationEnabled && !input.location) throw new VerificationLocationRequiredError();
    const location = settings.locationEnabled
      ? await this.locationResult(user.organizationId, employee.id, input)
      : null;

    const result = await attend();

    const now = this.clock.now();
    const base = {
      organizationId: user.organizationId,
      attendanceId: result.body.id,
      employeeId: employee.id,
      workDate: toDateColumn(result.body.workDate),
      moment,
      capturedAt: now,
      deleteAfter: new Date(now.getTime() + RESULT_RETENTION_MS),
    };
    await this.prisma.$transaction(async (tx) => {
      await this.repo.createResults(
        [
          ...(location ? [{ ...base, method: "location" as const, ...location }] : []),
          ...(photo
            ? [
                {
                  ...base,
                  method: "selfie" as const,
                  result: "captured" as const,
                  photoKey: photo.key,
                  photoDeleteAfter: new Date(now.getTime() + PHOTO_RETENTION_MS),
                },
              ]
            : []),
        ],
        tx,
      );
      if (photo) await this.repo.deletePendingPhoto(photo.id, tx);
    });
    return result;
  }

  /** Compared with the home area and offices, then dropped: only the outcome is stored (decision V3). */
  private async locationResult(
    organizationId: string,
    employeeId: string,
    input: RecordWithEvidenceInput,
  ) {
    if (!input.location) return { result: "no_approved_area" as const };
    const [locations, offices] = await Promise.all([
      this.repo.findWorkLocations(employeeId),
      this.repo.listOffices(organizationId),
    ]);
    const home = locations.find((location) => location.status === "approved") ?? null;
    const outcome = locationOutcome(input.location, home, offices);
    if (outcome.result === "no_approved_area") return { result: outcome.result };
    return { ...outcome, accuracyMeters: Math.round(input.location.accuracyMeters) };
  }

  /** The uploaded photo, once what arrived is checked. A bad file is removed, for a retake. */
  private async checkedPhoto(employeeId: string, moment: Moment) {
    const pending = await this.repo.findPendingPhoto(employeeId, moment);
    if (!pending) throw new VerificationPhotoRequiredError();
    const stored = await this.storage.head(pending.key);
    if (!stored) throw new UploadNotReceivedError();
    const start = await this.storage.readStart(pending.key, SIGNATURE_BYTES);
    const contentType = pending.contentType === "image/webp" ? "image/webp" : "image/jpeg";
    if (stored.size !== pending.size || !matchesContentType(start, contentType)) {
      await this.storage.delete(pending.key);
      await this.repo.deletePendingPhoto(pending.id);
      throw new UploadMismatchError();
    }
    return pending;
  }

  /** A URL for the photo, before anything is recorded. A retake replaces the earlier upload. */
  async createPhotoUpload(user: AuthUser, input: CreatePhotoUploadInput): Promise<PhotoUploadBody> {
    const settings = await this.effectiveSettings(user.organizationId);
    if (!settings.selfieEnabled) throw new VerificationDisabledError();
    const employee = await this.requireProfile(user);
    await this.requireNotice(employee);

    const earlier = await this.repo.findPendingPhoto(employee.id, input.moment);
    if (earlier) await this.storage.delete(earlier.key);
    const now = this.clock.now();
    const key = `verification-selfies/${user.organizationId}/${randomUUID()}${PHOTO_EXTENSIONS[input.contentType]}`;
    await this.repo.savePendingPhoto({
      organizationId: user.organizationId,
      employeeId: employee.id,
      moment: input.moment,
      key,
      contentType: input.contentType,
      size: input.size,
      expiresAt: new Date(now.getTime() + PENDING_PHOTO_TTL_MS),
    });
    return {
      uploadUrl: await this.storage.signUpload(key, input.contentType, input.size),
      uploadHeaders: { "Content-Type": input.contentType },
      expiresAt: new Date(now.getTime() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  // Approved areas

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

  // Offices (decision V13)

  async listOffices(user: AuthUser): Promise<{ items: OfficeBody[] }> {
    const rows = await this.repo.listOffices(user.organizationId);
    return { items: rows.map(toOffice) };
  }

  /** Can be set up before location checks are turned on. */
  async addOffice(user: AuthUser, input: AddOfficeInput): Promise<OfficeBody> {
    const created = await this.repo.createOffice({
      organizationId: user.organizationId,
      label: input.label,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters,
    });
    await this.emit(VERIFICATION_EVENTS.officeAdded, user, "office_location", created.id, {
      label: created.label,
    });
    return toOffice(created);
  }

  /** Results already recorded don't refer to the office, so they stay as they are. */
  async removeOffice(user: AuthUser, id: string): Promise<void> {
    const row = await this.repo.findOffice(user.organizationId, id);
    if (!row) throw new NotFoundError("Office");
    await this.repo.deleteOffice(id);
    await this.emit(VERIFICATION_EVENTS.officeRemoved, user, "office_location", id, {
      label: row.label,
    });
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
    return this.signPhoto(row.photoKey, fromDateColumn(row.workDate), row.moment);
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
    const verification = request.verification;
    if (!verification?.photoKey) throw new PhotoNotAvailableError();
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
    return this.signPhoto(
      verification.photoKey,
      fromDateColumn(request.workDate),
      verification.moment,
    );
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
      await this.storage.delete(row.key);
      await this.repo.deletePendingPhoto(row.id);
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

  private toItem(user: AuthUser, row: VerificationRow): VerificationItemBody {
    const canDiagnose = user.permissions.includes("verification:manage");
    return {
      id: row.id,
      attendanceId: row.attendanceId,
      workDate: fromDateColumn(row.workDate),
      moment: row.moment,
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

  private async signPhoto(key: string, workDate: string, moment: Moment): Promise<SignedPhotoBody> {
    return {
      url: await this.storage.signDownload(
        key,
        `${moment === "check_in" ? "check-in" : "check-out"}-photo-${workDate}${key.slice(key.lastIndexOf("."))}`,
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
