import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";

export const metadata: Metadata = { title: { default: "Your account", template: "%s · Your account · FuzzBall Factory" }, robots: { index: false } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
