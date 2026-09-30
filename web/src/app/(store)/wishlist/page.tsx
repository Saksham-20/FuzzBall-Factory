import type { Metadata } from "next";
import { WishlistClient } from "@/components/account/WishlistClient";

// Open to everyone: signed out, the list is this device's own; signed in, it is the account's.
export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default function PublicWishlistPage() {
  return (
    <div className="shell py-8 md:py-12">
      <WishlistClient />
    </div>
  );
}
