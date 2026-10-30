-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent', 'excused');

-- CreateEnum
CREATE TYPE "AttendanceCompletion" AS ENUM ('open', 'complete', 'not_applicable');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('self_service', 'close_day_job');

-- CreateEnum
CREATE TYPE "IdempotencyAction" AS ENUM ('attendance_check_in', 'attendance_check_out');

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_schedule_id" UUID,
    "work_date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "completion" "AttendanceCompletion" NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "check_in_at" TIMESTAMPTZ(3),
    "check_out_at" TIMESTAMPTZ(3),
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER,
    "schedule_timezone" VARCHAR(64) NOT NULL,
    "scheduled_start_at" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_end_at" TIMESTAMPTZ(3) NOT NULL,
    "on_time_deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "check_in_opens_at" TIMESTAMPTZ(3) NOT NULL,
    "check_in_closes_at" TIMESTAMPTZ(3) NOT NULL,
    "check_out_closes_at" TIMESTAMPTZ(3) NOT NULL,
    "close_day_run_id" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "corrected_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "action" "IdempotencyAction" NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "attendance_id" UUID,
    "response_status" SMALLINT,
    "response_body" JSONB,
    "locked_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendances_organization_id_employee_id_work_date_idx" ON "attendances"("organization_id", "employee_id", "work_date" DESC);

-- CreateIndex
CREATE INDEX "attendances_organization_id_work_date_status_completion_idx" ON "attendances"("organization_id", "work_date", "status", "completion");

-- CreateIndex
CREATE INDEX "attendances_organization_id_work_date_employee_id_idx" ON "attendances"("organization_id", "work_date", "employee_id");

-- CreateIndex
CREATE INDEX "attendances_employee_id_idx" ON "attendances"("employee_id");

-- CreateIndex
CREATE INDEX "attendances_work_schedule_id_idx" ON "attendances"("work_schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_organization_id_employee_id_work_date_key" ON "attendances"("organization_id", "employee_id", "work_date");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_records_user_id_idx" ON "idempotency_records"("user_id");

-- CreateIndex
CREATE INDEX "idempotency_records_attendance_id_idx" ON "idempotency_records"("attendance_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_user_id_key_key" ON "idempotency_records"("organization_id", "user_id", "key");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_work_schedule_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks Prisma can't express (DATA_MODEL.md §7.1)
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_counters_valid" CHECK (
  "late_minutes" >= 0 AND ("worked_minutes" IS NULL OR "worked_minutes" >= 0) AND "version" >= 1
);
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_completion_matches_timestamps" CHECK (
  ("completion" = 'open' AND "check_in_at" IS NOT NULL AND "check_out_at" IS NULL AND "worked_minutes" IS NULL)
  OR ("completion" = 'complete' AND "check_in_at" IS NOT NULL AND "check_out_at" IS NOT NULL
      AND "check_out_at" >= "check_in_at" AND "worked_minutes" IS NOT NULL)
  OR ("completion" = 'not_applicable' AND "check_in_at" IS NULL AND "check_out_at" IS NULL
      AND "status" IN ('absent', 'excused'))
);
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_status_matches_lateness" CHECK (
  ("status" = 'present' AND "late_minutes" = 0)
  OR ("status" = 'late' AND "late_minutes" > 0)
  OR ("status" IN ('absent', 'excused') AND "late_minutes" = 0)
);
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_snapshot_ordered" CHECK (
  "check_in_opens_at" <= "scheduled_start_at"
  AND "scheduled_start_at" < "scheduled_end_at"
  AND "check_in_opens_at" < "check_in_closes_at"
  AND "check_in_closes_at" <= "check_out_closes_at"
);
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_expiry_after_lock" CHECK ("expires_at" > "locked_at");
