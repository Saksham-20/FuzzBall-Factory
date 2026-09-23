import type { Metadata } from "next";
import { CustomClient } from "@/components/custom/CustomClient";

export const metadata: Metadata = {
  title: "Put in a work order",
  description: "Request a custom crochet piece or customize something from the shelf. Get a quote you can accept, counter or pass on.",
};

export default async function CustomPage(props: { searchParams: Promise<{ from?: string | string[]; resume?: string | string[] }> }) {
  const sp = await props.searchParams;
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  return <CustomClient from={first(sp.from) || undefined} resume={first(sp.resume) === "1"} />;
}
