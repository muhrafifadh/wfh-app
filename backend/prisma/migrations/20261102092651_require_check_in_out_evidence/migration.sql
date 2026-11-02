-- CreateEnum
CREATE TYPE "VerificationMoment" AS ENUM ('check_in', 'check_out');

-- Existing results were all taken at check-in
ALTER TABLE "attendance_verifications" ADD COLUMN "moment" "VerificationMoment" NOT NULL DEFAULT 'check_in';
ALTER TABLE "attendance_verifications" ALTER COLUMN "moment" DROP DEFAULT;

-- DropIndex
DROP INDEX "attendance_verifications_attendance_id_method_key";
DROP INDEX "attendance_verifications_pending_photo_expires_at_idx";

-- Uploads now happen before the attendance record exists, so they have their own table
ALTER TABLE "attendance_verifications" DROP COLUMN "pending_photo_content_type",
DROP COLUMN "pending_photo_expires_at",
DROP COLUMN "pending_photo_key",
DROP COLUMN "pending_photo_size";

-- CreateTable
CREATE TABLE "verification_pending_photos" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "moment" "VerificationMoment" NOT NULL,
    "key" TEXT NOT NULL,
    "content_type" VARCHAR(32) NOT NULL,
    "size" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pending_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_pending_photos_expires_at_idx" ON "verification_pending_photos"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "verification_pending_photos_employee_id_moment_key" ON "verification_pending_photos"("employee_id", "moment");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_verifications_attendance_id_moment_method_key" ON "attendance_verifications"("attendance_id", "moment", "method");

-- AddForeignKey
ALTER TABLE "verification_pending_photos" ADD CONSTRAINT "verification_pending_photos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_pending_photos" ADD CONSTRAINT "verification_pending_photos_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
