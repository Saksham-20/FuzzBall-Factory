import type { Metadata } from "next";
import { DropsClient } from "@/components/shop/DropsClient";

export const metadata: Metadata = {
  title: "Fresh off the line",
  description: "The newest handmade crochet pieces from FuzzBall Factory. Small batches and one-of-one pieces land here first.",
  alternates: { canonical: "/drops" },
};

export default function DropsPage() {
  return <DropsClient />;
}
