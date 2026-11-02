-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('location', 'selfie');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('verified', 'outside_approved_area', 'low_accuracy', 'not_shared', 'no_approved_area', 'captured');

-- CreateEnum
CREATE TYPE "VerificationDistanceBand" AS ENUM ('within_1km', 'within_10km', 'over_10km');

-- CreateEnum
CREATE TYPE "WorkLocationStatus" AS ENUM ('pending', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "VerificationPhotoRequestStatus" AS ENUM ('open', 'disclosed', 'declined');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "location_verification_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfie_verification_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "attendance_verifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "attendance_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "result" "VerificationResult" NOT NULL,
    "accuracy_meters" INTEGER,
    "distance_band" "VerificationDistanceBand",
    "captured_at" TIMESTAMPTZ(3),
    "photo_key" TEXT,
    "photo_delete_after" TIMESTAMPTZ(3),
    "pending_photo_key" TEXT,
    "pending_photo_content_type" VARCHAR(32),
    "pending_photo_size" INTEGER,
    "pending_photo_expires_at" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "delete_after" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendance_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL DEFAULT 1000,
    "status" "WorkLocationStatus" NOT NULL DEFAULT 'pending',
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_notice_acknowledgements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "notice_version" INTEGER NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_notice_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_photo_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "verification_id" UUID,
    "work_date" DATE NOT NULL,
    "status" "VerificationPhotoRequestStatus" NOT NULL DEFAULT 'open',
    "identity_check" VARCHAR(200),
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_photo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_verifications_organization_id_work_date_idx" ON "attendance_verifications"("organization_id", "work_date" DESC);

-- CreateIndex
CREATE INDEX "attendance_verifications_organization_id_result_reviewed_at_idx" ON "attendance_verifications"("organization_id", "result", "reviewed_at");

-- CreateIndex
CREATE INDEX "attendance_verifications_employee_id_work_date_idx" ON "attendance_verifications"("employee_id", "work_date" DESC);

-- CreateIndex
CREATE INDEX "attendance_verifications_delete_after_idx" ON "attendance_verifications"("delete_after");

-- CreateIndex
CREATE INDEX "attendance_verifications_photo_delete_after_idx" ON "attendance_verifications"("photo_delete_after");

-- CreateIndex
CREATE INDEX "attendance_verifications_pending_photo_expires_at_idx" ON "attendance_verifications"("pending_photo_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_verifications_attendance_id_method_key" ON "attendance_verifications"("attendance_id", "method");

-- CreateIndex
CREATE INDEX "work_locations_organization_id_status_created_at_idx" ON "work_locations"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "work_locations_employee_id_status_idx" ON "work_locations"("employee_id", "status");

-- CreateIndex
CREATE INDEX "work_locations_status_decided_at_idx" ON "work_locations"("status", "decided_at");

-- CreateIndex
CREATE INDEX "verification_notice_acknowledgements_organization_id_idx" ON "verification_notice_acknowledgements"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_notice_acknowledgements_employee_id_notice_ver_key" ON "verification_notice_acknowledgements"("employee_id", "notice_version");

-- CreateIndex
CREATE INDEX "verification_photo_requests_organization_id_status_created__idx" ON "verification_photo_requests"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "verification_photo_requests_employee_id_idx" ON "verification_photo_requests"("employee_id");

-- CreateIndex
CREATE INDEX "verification_photo_requests_verification_id_idx" ON "verification_photo_requests"("verification_id");

-- CreateIndex
CREATE INDEX "verification_photo_requests_status_decided_at_idx" ON "verification_photo_requests"("status", "decided_at");

-- AddForeignKey
ALTER TABLE "attendance_verifications" ADD CONSTRAINT "attendance_verifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_verifications" ADD CONSTRAINT "attendance_verifications_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_verifications" ADD CONSTRAINT "attendance_verifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_notice_acknowledgements" ADD CONSTRAINT "verification_notice_acknowledgements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_notice_acknowledgements" ADD CONSTRAINT "verification_notice_acknowledgements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_photo_requests" ADD CONSTRAINT "verification_photo_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_photo_requests" ADD CONSTRAINT "verification_photo_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_photo_requests" ADD CONSTRAINT "verification_photo_requests_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "attendance_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one pending and one approved area per employee (decision V5)
CREATE UNIQUE INDEX "work_locations_one_pending_per_employee" ON "work_locations"("employee_id") WHERE "status" = 'pending';
CREATE UNIQUE INDEX "work_locations_one_approved_per_employee" ON "work_locations"("employee_id") WHERE "status" = 'approved';

-- At most one open photo request per photo (decision V12)
CREATE UNIQUE INDEX "verification_photo_requests_one_open_per_verification" ON "verification_photo_requests"("verification_id") WHERE "status" = 'open';

ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_radius_range" CHECK ("radius_meters" BETWEEN 100 AND 10000);
ALTER TABLE "work_locations" ADD CONSTRAINT "work_locations_coordinates_range" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);

-- Admin/HR and owners get the verification permissions. Photo access stays a separate
-- permission, so it can be taken away from Admin/HR roles that shouldn't have it (V9).
-- Safe to re-run: permissions already held are skipped.
UPDATE "roles" SET "permissions" = "permissions" || ARRAY(
  SELECT p FROM unnest(ARRAY['verification:manage', 'verification:read_photo']) AS p
  WHERE NOT (p = ANY ("permissions"))
)
WHERE "name" IN ('owner', 'admin_hr');
