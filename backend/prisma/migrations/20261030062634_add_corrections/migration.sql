-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "attendance_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'pending',
    "pending_attendance_id" UUID,
    "current_check_in_at" TIMESTAMPTZ(3),
    "current_check_out_at" TIMESTAMPTZ(3),
    "requested_check_in_at" TIMESTAMPTZ(3) NOT NULL,
    "requested_check_out_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "expected_attendance_version" INTEGER NOT NULL,
    "decided_by_id" UUID,
    "decision_note" VARCHAR(1000),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_snapshots" (
    "id" UUID NOT NULL,
    "correction_request_id" UUID NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "schema_version" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correction_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "correction_requests_pending_attendance_id_key" ON "correction_requests"("pending_attendance_id");

-- CreateIndex
CREATE INDEX "correction_requests_organization_id_status_submitted_at_idx" ON "correction_requests"("organization_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "correction_requests_organization_id_employee_id_work_date_idx" ON "correction_requests"("organization_id", "employee_id", "work_date" DESC);

-- CreateIndex
CREATE INDEX "correction_requests_attendance_id_idx" ON "correction_requests"("attendance_id");

-- CreateIndex
CREATE INDEX "correction_requests_employee_id_idx" ON "correction_requests"("employee_id");

-- CreateIndex
CREATE INDEX "correction_requests_requested_by_id_idx" ON "correction_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "correction_requests_decided_by_id_idx" ON "correction_requests"("decided_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "correction_snapshots_correction_request_id_key" ON "correction_snapshots"("correction_request_id");

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_pending_attendance_id_fkey" FOREIGN KEY ("pending_attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_snapshots" ADD CONSTRAINT "correction_snapshots_correction_request_id_fkey" FOREIGN KEY ("correction_request_id") REFERENCES "correction_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks Prisma can't express (DATA_MODEL.md §8.1)
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_pending_marker" CHECK (
  ("status" = 'pending' AND "pending_attendance_id" = "attendance_id")
  OR ("status" <> 'pending' AND "pending_attendance_id" IS NULL)
);
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_decision_fields" CHECK (
  ("status" = 'pending' AND "decided_by_id" IS NULL AND "decided_at" IS NULL)
  OR ("status" = 'approved' AND "decided_by_id" IS NOT NULL AND "decided_at" IS NOT NULL)
  OR ("status" = 'rejected' AND "decided_by_id" IS NOT NULL AND "decided_at" IS NOT NULL
      AND "decision_note" IS NOT NULL)
);
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_no_self_decision" CHECK (
  "decided_by_id" IS NULL OR "decided_by_id" <> "requested_by_id"
);
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_times_ordered" CHECK (
  "requested_check_out_at" IS NULL OR "requested_check_out_at" >= "requested_check_in_at"
);
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_version_valid" CHECK (
  "expected_attendance_version" >= 1
);
ALTER TABLE "correction_snapshots" ADD CONSTRAINT "correction_snapshots_schema_version_valid" CHECK (
  "schema_version" >= 1
);
