-- One redemption per (coupon, order). NULL orderId (an order deleted later) stays allowed any number of times.
-- Fails loudly if duplicates already exist: resolve them by hand first (there should be none: an order redeems a coupon once).
CREATE UNIQUE INDEX "CouponRedemption_couponId_orderId_key" ON "CouponRedemption"("couponId", "orderId");
