"use client";

import { useSyncExternalStore } from "react";
import { createPersistedStore } from "@/lib/store";

const store = createPersistedStore<boolean>("fbf-tape-paused", false);

/**
 * Stops the tape marquee for keyboard and touch, where hover can't (WCAG 2.2.2). The choice is
 * remembered, so a stopped tape stays stopped on every page. globals.css pauses the track while
 * this button is pressed.
 */
export function TapeToggle() {
  const paused = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return (
    <button
      type="button"
      data-tape-toggle
      aria-pressed={paused}
      aria-label="Pause scrolling text"
      onClick={() => store.set((p) => !p)}
      className="press pointer-events-auto relative grid size-6 place-items-center rounded-full bg-cocoa text-butter transition-colors duration-150 before:absolute before:-inset-2 hf:hover:bg-brown"
    >
      <svg viewBox="0 0 12 12" className="size-3" fill="currentColor" aria-hidden>
        {paused ? (
          <path d="M4 2.6v6.8L10 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="2.5" y="2" width="2.6" height="8" rx="0.9" />
            <rect x="6.9" y="2" width="2.6" height="8" rx="0.9" />
          </>
        )}
      </svg>
    </button>
  );
}
