/** sessionStorage key the landing-page tracking form uses to pass order number + phone to /track without a URL. */
export const TRACK_HANDOFF_KEY = "fbf:track-handoff";

export interface TrackHandoff {
  order: string;
  contact: string;
}

/** Reads and clears the hand-off (one use), tolerating missing, blocked or malformed storage. */
export function takeTrackHandoff(storage: Pick<Storage, "getItem" | "removeItem"> | undefined = typeof sessionStorage === "undefined" ? undefined : sessionStorage): TrackHandoff | null {
  try {
    const raw = storage?.getItem(TRACK_HANDOFF_KEY);
    if (!raw) return null;
    storage?.removeItem(TRACK_HANDOFF_KEY);
    const v = JSON.parse(raw) as Partial<TrackHandoff>;
    return typeof v.order === "string" && typeof v.contact === "string" ? { order: v.order, contact: v.contact } : null;
  } catch {
    return null;
  }
}
