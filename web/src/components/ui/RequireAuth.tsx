"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HookSpinner } from "@/components/ui/misc";
import { useAuth } from "@/lib/state/AuthContext";

/** Client-side guard. Redirects to /login?next=… when logged out (or not an admin for role="admin"). */
export function RequireAuth({ children, role }: { children: ReactNode; role?: "admin" }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const allowed = !!user && (!role || user.role === role);

  useEffect(() => {
    if (!loading && !allowed) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, allowed, router, path]);

  if (loading || !allowed) {
    return (
      <div className="grid min-h-[50dvh] place-items-center">
        <HookSpinner />
      </div>
    );
  }
  return <>{children}</>;
}
