import type { Metadata } from "next";
import { LoginForm } from "@/components/account/auth/LoginForm";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage(props: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await props.searchParams;
  return <LoginForm next={Array.isArray(next) ? next[0] : next} />;
}
