"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPersistedStore } from "@/lib/store";
import { SITE } from "@/lib/site";

const store = createPersistedStore<boolean>("fbf-show-placeholders", false);

/**
 * Dev aid: outlines and labels everything tagged `data-placeholder` so nothing
 * unfinished ships by accident. Only rendered while running on sample data.
 * Registry: docs/PLACEHOLDERS.md
 */
export function PlaceholderToggle() {
  const on = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-show-placeholders", on);
  }, [on]);
  if (!SITE.useMock) return null;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-kraft">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => store.set(e.target.checked)}
        className="size-4 accent-butter"
      />
      Show placeholder tags
    </label>
  );
}
