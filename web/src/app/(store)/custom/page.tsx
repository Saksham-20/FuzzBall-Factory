import type { Metadata } from "next";
import { CustomClient } from "@/components/custom/CustomClient";
import { ideaKey } from "@/lib/custom-ideas";
import { first } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Make me one",
  alternates: { canonical: "/custom" },
  description: "Ask for a custom crochet piece or customize something from the shelf. Get a quote you can accept, counter or pass on.",
};

export default async function CustomPage(props: {
  searchParams: Promise<{ from?: string | string[]; idea?: string | string[]; resume?: string | string[] }>;
}) {
  const sp = await props.searchParams;
  return <CustomClient from={first(sp.from) || undefined} idea={ideaKey(first(sp.idea))} resume={first(sp.resume) === "1"} />;
}
