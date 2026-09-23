import type { Metadata } from "next";
import { ResetForm } from "@/components/account/auth/ResetForm";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage(props: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await props.searchParams;
  return <ResetForm token={Array.isArray(token) ? token[0] : token} />;
}
