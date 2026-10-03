import type { Metadata } from "next";
import { TicketsClient } from "@/components/account/TicketsClient";

export const metadata: Metadata = { title: "Help requests" };

export default function HelpRequestsPage() {
  return <TicketsClient />;
}
