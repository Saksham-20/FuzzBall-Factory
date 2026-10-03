-- AlterTable
ALTER TABLE "Product" ADD COLUMN "netQuantity" TEXT NOT NULL DEFAULT '1 piece',
ADD COLUMN "safetyNote" TEXT;
