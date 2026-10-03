import type { Metadata } from "next";
import { TicketDetailClient } from "@/components/account/TicketDetailClient";
import { routeParam } from "@/lib/route-param";

export async function generateMetadata(props: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Request ${routeParam(number)}` };
}

export default async function HelpRequestPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
  return <TicketDetailClient number={routeParam(number)} />;
}
