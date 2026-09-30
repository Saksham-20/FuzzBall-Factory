-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundReserved" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RefundJob" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "razorpayRefundId" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundJob_razorpayRefundId_key" ON "RefundJob"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "RefundJob_status_nextAttemptAt_idx" ON "RefundJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "RefundJob_paymentId_idx" ON "RefundJob"("paymentId");

-- AddForeignKey
ALTER TABLE "RefundJob" ADD CONSTRAINT "RefundJob_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
