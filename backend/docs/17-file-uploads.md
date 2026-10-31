# 17 · File Uploads

Files go **straight from the browser to object storage**. The API never receives the bytes: it signs a short-lived URL, records the upload, and checks what arrived. Security rules for files live in [13](13-security.md#files); this doc is the flow.

## Stack

| Need    | Tool                                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Storage | Any S3-compatible service (AWS S3, R2, …). Locally: the `storage` container ([RustFS](https://rustfs.com), a MinIO drop-in) |
| Client  | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, wrapped by `StorageService` (`src/infra/storage/`)                  |
| Records | `uploads` table (`modules/uploads`)                                                                                         |
| Cleanup | `uploads-cleanup` queue, a daily BullMQ job scheduler ([15](15-background-jobs.md))                                         |

## The flow

```
1. POST /v1/uploads { filename, contentType, size }
     → 201 { upload (status "pending"), uploadUrl, uploadHeaders, expiresAt }
2. Browser: PUT uploadUrl with uploadHeaders and the file   (straight to storage)
3. POST /v1/uploads/:id/complete
     → 200 upload (status "ready", downloadUrl)
     → 409 UPLOAD_NOT_RECEIVED  the PUT hasn't happened (or the URL expired)
     → 422 UPLOAD_MISMATCH      size or content didn't match; the file is deleted
4. GET /v1/uploads/:id → upload with a fresh downloadUrl (15 minutes)
   GET /v1/uploads?q=…   → the organization's ready uploads, newest first, each with a downloadUrl
```

## Rules

- **Allowed types and the size limit are in `uploads.constants.ts`.** The DTO rejects anything else, and the signed URL pins `Content-Type` and `Content-Length`, so the PUT can't send something bigger or different.
- **Complete checks the bytes, not the header:** the first 512 bytes must match the declared type (`file-signature.ts`).
- **Object keys are generated** (`<organizationId>/<uuid>.<ext>`). The filename is only for display and the download name.
- **Uploads belong to an organization.** Anyone in it can read one; only the uploader can complete or delete it. Features that attach files (an avatar, an invoice PDF) store the upload id and add their own permission checks.
- **Delete is a soft delete.** The cleanup job removes the file a week later, and abandoned uploads (still pending after a day) right away.
- **Outside production the API creates its bucket and CORS rules on startup.** In production the bucket, its CORS rules (allow `PUT`/`GET` from your frontend origins) and lifecycle are infrastructure, not app code.
- **On AWS, leave `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` unset** and give the instance or task role access to the bucket.

## Don't

- **Don't proxy file bytes through the API.** It ties up the server and bypasses the size limit on the signed URL.
- **Don't build object keys from user input.**
- **Don't make the bucket public.** Every download goes through a signed URL.
- **Don't hand out a download URL for a `pending` upload.** Nothing has checked it yet.

## Related

[13 Security](13-security.md) · [15 Background jobs](15-background-jobs.md) · [11 Configuration](11-configuration.md)
