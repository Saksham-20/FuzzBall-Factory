-- Integrity constraints and missing foreign-key indexes.
--
-- Written by hand (Prisma cannot model CHECKs or partial unique indexes). Rules for this file:
--  * It first counts rows that would break each rule and stops with a readable message, so a dirty database fails here
--    with a list instead of half-way through an ALTER.
--  * Plain CREATE INDEX (not CONCURRENTLY): a migration runs in one transaction. The tables are small at launch; on a
--    large table create the index CONCURRENTLY by hand first, then let this statement find it (IF NOT EXISTS).

-- 1. Pre-check ----------------------------------------------------------------------------------------------------
DO $$
DECLARE
  rule RECORD;
  bad BIGINT;
  problems TEXT := '';
BEGIN
  FOR rule IN
    SELECT * FROM (VALUES
      ('ProductVariant', 'stock >= 0'),
      ('OrderItem', 'qty > 0 AND "unitPrice" >= 0'),
      ('Order', 'subtotal >= 0 AND shipping >= 0 AND "codFee" >= 0 AND "giftWrap" >= 0 AND discount >= 0 AND total >= 0'),
      ('Payment', 'amount > 0 AND "refundedAmount" >= 0 AND "refundReserved" >= 0 AND "refundedAmount" <= amount AND "refundReserved" <= amount'),
      ('RefundJob', 'amount > 0'),
      ('Quote', 'price > 0 AND "depositPct" BETWEEN 0 AND 100'),
      ('CustomRequest', 'quantity > 0 AND "budgetMin" >= 0 AND "budgetMax" >= "budgetMin"'),
      ('Review', 'rating BETWEEN 1 AND 5'),
      ('Coupon', 'value >= 0 AND uses >= 0 AND "minCart" >= 0 AND ("maxUses" IS NULL OR "maxUses" >= 0) AND ("perUserLimit" IS NULL OR "perUserLimit" > 0) AND (kind <> ''PERCENT'' OR value <= 100)'),
      ('CouponRedemption', 'amount >= 0'),
      ('Product', 'price >= 0')
    ) AS t(tbl, expr)
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE NOT (%s)', rule.tbl, rule.expr) INTO bad;
    IF bad > 0 THEN
      problems := problems || format(E'\n  %s: %s row(s) break "%s"', rule.tbl, bad, rule.expr);
    END IF;
  END LOOP;

  SELECT count(*) INTO bad FROM (SELECT 1 FROM "Quote" WHERE status = 'ACCEPTED' GROUP BY "requestId" HAVING count(*) > 1) d;
  IF bad > 0 THEN
    problems := problems || format(E'\n  Quote: %s work order(s) have more than one ACCEPTED quote', bad);
  END IF;

  IF problems <> '' THEN
    RAISE EXCEPTION 'Existing rows break the new integrity rules. Fix them, then run the migration again:%', problems;
  END IF;
END $$;

-- 2. CHECK constraints ---------------------------------------------------------------------------------------------
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonneg" CHECK (stock >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_positive" CHECK (qty > 0 AND "unitPrice" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_nonneg" CHECK (subtotal >= 0 AND shipping >= 0 AND "codFee" >= 0 AND "giftWrap" >= 0 AND discount >= 0 AND total >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK (amount > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refunds_within_amount" CHECK ("refundedAmount" >= 0 AND "refundReserved" >= 0 AND "refundedAmount" <= amount AND "refundReserved" <= amount);
ALTER TABLE "RefundJob" ADD CONSTRAINT "RefundJob_amount_positive" CHECK (amount > 0);
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_price_positive" CHECK (price > 0 AND "depositPct" BETWEEN 0 AND 100);
ALTER TABLE "CustomRequest" ADD CONSTRAINT "CustomRequest_quantity_budget" CHECK (quantity > 0 AND "budgetMin" >= 0 AND "budgetMax" >= "budgetMin");
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_values_sane" CHECK (value >= 0 AND uses >= 0 AND "minCart" >= 0 AND ("maxUses" IS NULL OR "maxUses" >= 0) AND ("perUserLimit" IS NULL OR "perUserLimit" > 0) AND (kind <> 'PERCENT' OR value <= 100));
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_amount_nonneg" CHECK (amount >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_nonneg" CHECK (price >= 0);

-- 3. One accepted quote per work order ------------------------------------------------------------------------------
CREATE UNIQUE INDEX "Quote_one_accepted_per_request" ON "Quote"("requestId") WHERE status = 'ACCEPTED';

-- 4. Foreign-key indexes (Prisma-modelled: they are also declared in schema.prisma) ----------------------------------
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE INDEX IF NOT EXISTS "Payment_quoteId_idx" ON "Payment"("quoteId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "Review_orderId_idx" ON "Review"("orderId");
CREATE INDEX IF NOT EXISTS "CustomRequest_baseProductId_idx" ON "CustomRequest"("baseProductId");
