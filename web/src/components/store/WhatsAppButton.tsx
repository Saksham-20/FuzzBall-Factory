"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { waGeneral } from "@/lib/whatsapp";

/** Floating "chat with the maker". Tooltip nudges once per session after 8s. */
export function WhatsAppButton() {
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("fbf-wa-nudged")) return;
    } catch {
      return;
    }
    const show = setTimeout(() => {
      setNudge(true);
      try {
        sessionStorage.setItem("fbf-wa-nudged", "1");
      } catch {}
    }, 8000);
    const hide = setTimeout(() => setNudge(false), 8000 + 6000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  return (
    <div data-wa-button className="fixed right-4 bottom-4 z-40 flex items-center gap-3 md:right-6 md:bottom-6" style={{ bottom: "calc(1rem + var(--sticky-offset, 0px))" }}>
      <span
        role="status"
        className={
          "hidden rounded-full bg-paper px-4 py-2 text-sm font-semibold text-cocoa shadow-lift transition-[opacity,transform] duration-300 ease-out sm:block " +
          (nudge ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-2 opacity-0")
        }
      >
        Questions? Chat with the maker
      </span>
      <a
        href={waGeneral()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="press grid size-14 place-items-center rounded-full bg-cocoa text-cream shadow-lift transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-brown"
      >
        <MessageCircle className="size-6" strokeWidth={1.8} />
      </a>
    </div>
  );
}
