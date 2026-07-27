-- CreateTable
CREATE TABLE "IndustrialLead" (
    "id" TEXT NOT NULL,
    "industrialServiceId" TEXT,
    "serviceName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "sector" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "siteLocation" TEXT NOT NULL DEFAULT '',
    "load" TEXT NOT NULL DEFAULT '',
    "budget" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'New',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndustrialLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndustrialLead_industrialServiceId_idx" ON "IndustrialLead"("industrialServiceId");

-- CreateIndex
CREATE INDEX "IndustrialLead_status_idx" ON "IndustrialLead"("status");

-- CreateIndex
CREATE INDEX "IndustrialLead_createdAt_idx" ON "IndustrialLead"("createdAt");

-- AddForeignKey
ALTER TABLE "IndustrialLead" ADD CONSTRAINT "IndustrialLead_industrialServiceId_fkey" FOREIGN KEY ("industrialServiceId") REFERENCES "IndustrialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
