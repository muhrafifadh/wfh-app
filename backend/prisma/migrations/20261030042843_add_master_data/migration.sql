-- CreateEnum
CREATE TYPE "DivisionStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "retention_years" SMALLINT NOT NULL DEFAULT 5,
ADD COLUMN     "support_contact" VARCHAR(255),
ADD COLUMN     "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta';

-- CreateTable
CREATE TABLE "divisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "DivisionStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "division_id" UUID NOT NULL,
    "manager_id" UUID,
    "employee_number" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "work_email" VARCHAR(255),
    "job_title" VARCHAR(120),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'active',
    "employment_start_date" DATE NOT NULL,
    "employment_end_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "divisions_organization_id_status_name_idx" ON "divisions"("organization_id", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_organization_id_code_key" ON "divisions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_organization_id_name_key" ON "divisions"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_division_id_idx" ON "employees"("organization_id", "status", "division_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_manager_id_idx" ON "employees"("organization_id", "manager_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_full_name_idx" ON "employees"("organization_id", "full_name");

-- CreateIndex
CREATE INDEX "employees_division_id_idx" ON "employees"("division_id");

-- CreateIndex
CREATE INDEX "employees_manager_id_idx" ON "employees"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_number_key" ON "employees"("organization_id", "employee_number");

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks Prisma can't express (DOMAIN_RULES.md §4, DATA_MODEL.md §4.1, §6)
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_retention_years_range" CHECK ("retention_years" BETWEEN 1 AND 10);
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9-]{1,31}$');
ALTER TABLE "employees" ADD CONSTRAINT "employees_employee_number_format" CHECK ("employee_number" ~ '^[A-Z0-9][A-Z0-9-]{2,31}$');
ALTER TABLE "employees" ADD CONSTRAINT "employees_not_own_manager" CHECK ("manager_id" <> "id");
ALTER TABLE "employees" ADD CONSTRAINT "employees_employment_period" CHECK ("employment_end_date" IS NULL OR "employment_end_date" >= "employment_start_date");

-- Data: the Hadir.in roles (DEFAULT_ROLES in src/common/types/auth.ts) in every
-- existing organization, and owners get the new permissions.
-- Safe to re-run: existing roles and permissions are skipped.
INSERT INTO "roles" ("id", "organization_id", "name", "permissions", "updated_at")
SELECT gen_random_uuid(), o."id", r."name", r."permissions", CURRENT_TIMESTAMP
FROM "organizations" o
CROSS JOIN (VALUES
  ('admin_hr', ARRAY['attendance:self', 'correction:submit', 'attendance:read_all', 'correction:decide_all', 'report:read_all', 'employee:manage', 'division:manage', 'policy:manage', 'holiday:manage', 'user:read', 'user:manage', 'audit:read']),
  ('manager', ARRAY['attendance:self', 'correction:submit', 'attendance:read_team', 'correction:decide_team', 'report:read_team']),
  ('employee', ARRAY['attendance:self', 'correction:submit'])
) AS r("name", "permissions")
ON CONFLICT ("organization_id", "name") DO NOTHING;

UPDATE "roles" SET "permissions" = "permissions" || ARRAY(
  SELECT p FROM unnest(ARRAY['attendance:self', 'attendance:read_team', 'attendance:read_all', 'correction:submit', 'correction:decide_team', 'correction:decide_all', 'report:read_team', 'report:read_all', 'employee:manage', 'division:manage', 'policy:manage', 'holiday:manage']) AS p
  WHERE NOT (p = ANY ("permissions"))
)
WHERE "name" = 'owner';
