-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "billedRate" DOUBLE PRECISION,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false;
