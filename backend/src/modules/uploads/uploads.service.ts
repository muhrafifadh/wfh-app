import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { z } from "zod";

import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import { matchesContentType, SIGNATURE_BYTES } from "@/common/files/file-signature.js";
import { UploadMismatchError, UploadNotReceivedError } from "@/common/files/upload.errors.js";
import type { AuthUser } from "@/common/types/auth.js";
import { SIGNED_URL_TTL_SECONDS, StorageService } from "@/infra/storage/storage.service.js";
import type { CreateUploadInput } from "@/modules/uploads/dto/create-upload.dto.js";
import type { ListUploadsQueryInput } from "@/modules/uploads/dto/list-uploads.query.js";
import type {
  CreateUploadResponseBody,
  UploadResponseBody,
} from "@/modules/uploads/dto/upload.response.js";
import {
  ALLOWED_CONTENT_TYPES,
  CONTENT_TYPE_EXTENSIONS,
  DELETED_UPLOAD_RETENTION_MS,
  PENDING_UPLOAD_TTL_MS,
} from "@/modules/uploads/uploads.constants.js";
import { UploadsRepository, type UploadRow } from "@/modules/uploads/uploads.repository.js";

/** How many expired uploads one cleanup run handles; the next run picks up the rest. */
const CLEANUP_BATCH = 500;

/** The column is text; rows only ever hold allowed types (the DTO checks on the way in). */
const contentTypeSchema = z.enum(ALLOWED_CONTENT_TYPES);

/**
 * docs/17-file-uploads.md — the API signs URLs and keeps the records; file bytes
 * go straight between the browser and storage.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly repo: UploadsRepository,
    private readonly storage: StorageService,
  ) {}

  /** Step 1: a pending record and a URL to PUT the file to. */
  async create(user: AuthUser, input: CreateUploadInput): Promise<CreateUploadResponseBody> {
    // The key is ours, never the client's: no path tricks, no overwriting other files
    const key = `${user.organizationId}/${randomUUID()}${CONTENT_TYPE_EXTENSIONS[input.contentType]}`;
    const upload = await this.repo.insert({
      ...input,
      key,
      organizationId: user.organizationId,
      uploadedById: user.id,
    });
    const uploadUrl = await this.storage.signUpload(key, input.contentType, input.size);
    return {
      upload: await this.toUpload(upload),
      uploadUrl,
      uploadHeaders: { "Content-Type": input.contentType },
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /** Step 2: after the PUT, check what arrived and make it downloadable. */
  async complete(user: AuthUser, id: string): Promise<UploadResponseBody> {
    const upload = await this.loadOwn(user, id);
    if (upload.status === "ready") return this.toUpload(upload);

    const stored = await this.storage.head(upload.key);
    if (!stored) throw new UploadNotReceivedError();
    // The signed URL already pins size and type; the bytes are checked too (docs/13-security.md#files)
    const start = await this.storage.readStart(upload.key, SIGNATURE_BYTES);
    const contentType = contentTypeSchema.parse(upload.contentType);
    if (stored.size !== upload.size || !matchesContentType(start, contentType)) {
      await this.storage.delete(upload.key);
      throw new UploadMismatchError();
    }
    return this.toUpload(await this.repo.markReady(id));
  }

  /** The organization's completed uploads, each with a fresh download link. */
  async list(user: AuthUser, query: ListUploadsQueryInput): Promise<Paginated<UploadResponseBody>> {
    const { rows, total } = await this.repo.listReady(user.organizationId, query);
    // Signing is local (no request to storage), so a link per row is cheap
    const items = await Promise.all(rows.map((row) => this.toUpload(row)));
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  /** Anyone in the organization can read an upload. */
  async findOne(user: AuthUser, id: string): Promise<UploadResponseBody> {
    const upload = await this.repo.findInOrganization(user.organizationId, id);
    if (!upload) throw new NotFoundError("Upload");
    return this.toUpload(upload);
  }

  /** Soft delete. The file stays in storage for a week, then the cleanup job removes it. */
  async remove(user: AuthUser, id: string): Promise<void> {
    await this.loadOwn(user, id);
    await this.repo.softDelete(id, new Date());
  }

  /** Run by the scheduled cleanup job. Returns how many uploads were purged. */
  async purgeExpired(now = new Date()): Promise<number> {
    const expired = await this.repo.findExpired(
      new Date(now.getTime() - PENDING_UPLOAD_TTL_MS),
      new Date(now.getTime() - DELETED_UPLOAD_RETENTION_MS),
      CLEANUP_BATCH,
    );
    // Storage first: if the run stops halfway, the rows are still there for the next one
    for (const upload of expired) await this.storage.delete(upload.key);
    await this.repo.purge(expired.map((upload) => upload.id));
    return expired.length;
  }

  /** Completing and deleting are for the uploader only; anyone else gets 404. */
  private async loadOwn(user: AuthUser, id: string): Promise<UploadRow> {
    const upload = await this.repo.findInOrganization(user.organizationId, id);
    if (!upload || upload.uploadedById !== user.id) throw new NotFoundError("Upload");
    return upload;
  }

  private async toUpload(row: UploadRow): Promise<UploadResponseBody> {
    return {
      id: row.id,
      filename: row.filename,
      contentType: contentTypeSchema.parse(row.contentType),
      size: row.size,
      status: row.status,
      uploadedBy: row.uploadedBy,
      downloadUrl:
        row.status === "ready" ? await this.storage.signDownload(row.key, row.filename) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
