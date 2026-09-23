import type { ReactNode } from "react";
import type { ReadSection } from "@/components/content/ReadLayout";

export interface PolicyDoc {
  slug: "shipping" | "refund" | "terms" | "privacy" | "grievance";
  /** h1 on the page. */
  title: string;
  /** <title> and link label. */
  shortTitle: string;
  description: string;
  intro: ReactNode;
  summary: { head: string; points: ReactNode[] };
  sections: ReadSection[];
}
