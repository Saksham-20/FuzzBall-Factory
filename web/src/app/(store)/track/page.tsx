import type { Metadata } from "next";
import { TrackClient } from "@/components/checkout/TrackClient";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Look up your FuzzBall Factory order with your order number and phone or email.",
};

export default async function TrackPage(props: { searchParams: Promise<{ order?: string | string[]; phone?: string | string[]; email?: string | string[] }> }) {
  const sp = await props.searchParams;
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <TrackClient initialOrder={first(sp.order)} initialContact={first(sp.phone) || first(sp.email)} />;
}
