-- The server-side cart was never used (the storefront keeps the basket in the browser and sends it at checkout).
DROP TABLE "CartItem";
DROP TABLE "Cart";

-- A work order carries money and a customer's design: deleting a user must not silently delete it.
-- Erasing a customer (DPDP) anonymises the user row instead; deleting one with work orders is now refused.
ALTER TABLE "CustomRequest" DROP CONSTRAINT "CustomRequest_userId_fkey";
ALTER TABLE "CustomRequest" ADD CONSTRAINT "CustomRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
