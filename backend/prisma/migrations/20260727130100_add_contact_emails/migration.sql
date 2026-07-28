-- Real, deliverable addresses for password-reset OTPs. Nullable: existing
-- accounts and guest-checkout customers have none and cannot self-reset until
-- one is set. Distinct from user.email, which stays the synthetic sign-in id.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");
