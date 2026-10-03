import { Suspense } from "react";
import type { Metadata } from "next";
import { GuestTicketClient } from "@/components/support/GuestTicketClient";
import { routeParam } from "@/lib/route-param";

// A private page reached from an emailed link: never indexed, never cached for others.
export const metadata: Metadata = { title: "Your request", robots: { index: false, follow: false } };

export default async function GuestTicketPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
  return (
    <Suspense>
      <GuestTicketClient number={routeParam(number)} />
    </Suspense>
  );
}
