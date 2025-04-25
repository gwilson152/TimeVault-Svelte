/*
  Warnings:

  - Added the required column `updatedAt` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "billing_rates" ADD COLUMN     "cost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "billingRateId" TEXT;

-- CreateIndex
CREATE INDEX "invoices_clientId_idx" ON "invoices"("clientId");

-- CreateIndex
CREATE INDEX "time_entries_clientId_idx" ON "time_entries"("clientId");

-- CreateIndex
CREATE INDEX "time_entries_invoiceId_idx" ON "time_entries"("invoiceId");

-- CreateIndex
CREATE INDEX "time_entries_billingRateId_idx" ON "time_entries"("billingRateId");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_billingRateId_fkey" FOREIGN KEY ("billingRateId") REFERENCES "billing_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
