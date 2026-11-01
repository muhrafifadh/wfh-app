-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'reminder_check_in';
ALTER TYPE "NotificationType" ADD VALUE 'reminder_check_out';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "work_date" DATE;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "check_in_reminder_at" TIME(0) NOT NULL DEFAULT '09:00:00'::time,
ADD COLUMN     "check_in_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "check_out_reminder_at" TIME(0) NOT NULL DEFAULT '18:00:00'::time,
ADD COLUMN     "check_out_reminder_enabled" BOOLEAN NOT NULL DEFAULT true;
