"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/state/AuthContext";
import { CartProvider } from "@/lib/state/CartContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}
