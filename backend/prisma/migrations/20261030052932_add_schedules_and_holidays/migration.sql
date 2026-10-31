-- CreateEnum
CREATE TYPE "ScheduleScope" AS ENUM ('organization', 'division', 'employee');

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "scope" "ScheduleScope" NOT NULL DEFAULT 'organization',
    "timezone" VARCHAR(64) NOT NULL,
    "working_days" SMALLINT[],
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "tolerance_minutes" SMALLINT NOT NULL,
    "check_in_opens_at" TIME(0) NOT NULL,
    "check_in_closes_at" TIME(0) NOT NULL,
    "check_out_deadline" TIME(3) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_schedules_organization_id_scope_effective_from_effecti_idx" ON "work_schedules"("organization_id", "scope", "effective_from", "effective_to");

-- CreateIndex
CREATE INDEX "work_schedules_created_by_id_idx" ON "work_schedules"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_organization_id_scope_effective_from_key" ON "work_schedules"("organization_id", "scope", "effective_from");

-- CreateIndex
CREATE INDEX "holidays_organization_id_date_idx" ON "holidays"("organization_id", "date");

-- CreateIndex
CREATE INDEX "holidays_created_by_id_idx" ON "holidays"("created_by_id");

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks Prisma can't express (DOMAIN_RULES.md §6.1, DATA_MODEL.md §6.3)
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_scope_organization_only" CHECK ("scope" = 'organization');
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_working_days_valid" CHECK (
  "working_days" IS NOT NULL
  AND cardinality("working_days") BETWEEN 1 AND 7
  AND "working_days" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]
);
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_tolerance_range" CHECK ("tolerance_minutes" BETWEEN 0 AND 120);
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_times_ordered" CHECK (
  "check_in_opens_at" <= "start_time"
  AND "start_time" < "end_time"
  AND "check_in_opens_at" < "check_in_closes_at"
  AND "check_in_closes_at" <= "check_out_deadline"
);
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_period" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");
