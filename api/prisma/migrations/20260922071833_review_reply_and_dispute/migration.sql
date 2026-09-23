-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'DISPUTED';

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "reply" TEXT;
