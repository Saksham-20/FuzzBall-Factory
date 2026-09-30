import type { Metadata } from "next";
import { VerifyEmailClient } from "@/components/account/auth/VerifyEmailClient";
import { first } from "@/lib/search-params";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams;
  return <VerifyEmailClient token={first(token)} />;
}
