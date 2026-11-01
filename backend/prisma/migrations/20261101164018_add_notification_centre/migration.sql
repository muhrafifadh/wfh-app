-- DropIndex
DROP INDEX "notifications_recipient_id_created_at_idx";

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "emailed_at" TIMESTAMPTZ(3),
ADD COLUMN     "link" VARCHAR(300),
ADD COLUMN     "title" VARCHAR(200);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "review_requests_email" BOOLEAN NOT NULL DEFAULT true,
    "correction_updates_email" BOOLEAN NOT NULL DEFAULT true,
    "check_in_reminder_email" BOOLEAN NOT NULL DEFAULT true,
    "check_out_reminder_email" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_status_sent_at_idx" ON "notifications"("recipient_id", "status", "sent_at" DESC);

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notifications delivered before this migration were all emailed
UPDATE "notifications" SET "emailed_at" = "sent_at" WHERE "status" = 'sent';
