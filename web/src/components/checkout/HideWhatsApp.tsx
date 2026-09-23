"use client";

import { useEffect } from "react";

/** Hides the floating WhatsApp button while mounted (checkout keeps attention on paying). */
export function HideWhatsApp() {
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-hide-wa", "");
    return () => el.removeAttribute("data-hide-wa");
  }, []);
  return null;
}
