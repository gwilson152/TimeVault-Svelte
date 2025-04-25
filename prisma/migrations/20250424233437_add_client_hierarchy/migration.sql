-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'business';

-- CreateIndex
CREATE INDEX "clients_parentId_idx" ON "clients"("parentId");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
