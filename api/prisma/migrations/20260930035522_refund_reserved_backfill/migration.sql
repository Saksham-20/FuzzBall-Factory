-- Payments refunded before RefundJob existed: their refunded rupees are already claimed.
UPDATE "Payment" SET "refundReserved" = "refundedAmount" WHERE "refundedAmount" > 0;
