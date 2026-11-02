-- AlterEnum
ALTER TYPE "VerificationResult" ADD VALUE 'at_office' BEFORE 'outside_approved_area';

-- CreateTable
CREATE TABLE "office_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "office_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "office_locations_organization_id_created_at_idx" ON "office_locations"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "office_locations" ADD CONSTRAINT "office_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma can't express these
ALTER TABLE "office_locations" ADD CONSTRAINT "office_locations_radius_range" CHECK ("radius_meters" BETWEEN 100 AND 10000);
ALTER TABLE "office_locations" ADD CONSTRAINT "office_locations_coordinates_range" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);
