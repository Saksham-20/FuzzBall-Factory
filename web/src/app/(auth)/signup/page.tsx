import type { Metadata } from "next";
import { SignupForm } from "@/components/account/auth/SignupForm";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function SignupPage() {
  return <SignupForm />;
}
