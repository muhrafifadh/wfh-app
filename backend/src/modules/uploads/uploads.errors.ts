import { AppError } from "@/common/errors/app-error.js";

/** Complete was called before the file reached storage (or the upload URL expired). */
export class UploadNotReceivedError extends AppError {
  readonly status = 409;
  readonly code = "UPLOAD_NOT_RECEIVED";

  constructor() {
    super("The file hasn't been uploaded yet. Upload it, then try again.");
  }
}

/** The stored file isn't what was declared. It is deleted; start a new upload. */
export class UploadMismatchError extends AppError {
  readonly status = 422;
  readonly code = "UPLOAD_MISMATCH";

  constructor() {
    super("The uploaded file doesn't match its size or type. Please upload it again.");
  }
}
