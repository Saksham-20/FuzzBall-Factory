import type { Metadata } from "next";
import { TrackClient } from "@/components/checkout/TrackClient";
import { first } from "@/lib/search-params";

// Never indexed: the page only ever shows one customer's order, and links to it carry an order number.
export const metadata: Metadata = {
  title: "Track your order",
  description: "Look up your FuzzBall Factory order with your order number and phone or email.",
  robots: { index: false },
};

/** Only the order number may arrive in the URL (from the order page). A phone or email in the query is ignored. */
export default async function TrackPage(props: { searchParams: Promise<{ order?: string | string[] }> }) {
  const sp = await props.searchParams;
  const order = first(sp.order);
  return <TrackClient initialOrder={order ?? ""} />;
}
