import type { Metadata } from "next";
import { VerifyEmailClient } from "@/components/account/auth/VerifyEmailClient";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams;
  return <VerifyEmailClient token={Array.isArray(token) ? token[0] : token} />;
}
