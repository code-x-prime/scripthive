-- AlterTable
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "productionStatus" TEXT;
