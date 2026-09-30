"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia(QUERY).matches;

interface Props {
  src: string;
  poster: string;
  /** What the clip shows, for the video's label and the pause button. */
  label: string;
  className?: string;
}

/**
 * A short silent loop that plays only while it is on screen (no autoplay cost below the fold, and
 * nothing moving off screen). Reduced motion starts it stopped. The pause button is WCAG 2.2.2's
 * way out of a loop that never ends; it has the same look as the tape's.
 */
export function LoopClip({ src, poster, label, className }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  // null = no choice made yet: follow reduced motion. Once pressed, the choice wins.
  const [choice, setChoice] = useState<boolean | null>(null);
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const wantPlay = choice ?? !reduced;
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (wantPlay && visible) void el.play().catch(() => {});
    else el.pause();
  }, [wantPlay, visible]);

  return (
    <div className={className}>
      <video
        ref={video}
        src={src}
        poster={poster}
        aria-label={label}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        className="absolute inset-0 size-full object-cover"
      />
      <button
        type="button"
        aria-pressed={!wantPlay}
        aria-label={wantPlay ? `Pause video: ${label}` : `Play video: ${label}`}
        onClick={() => setChoice(!wantPlay)}
        className="press absolute right-2 bottom-2 grid size-7 place-items-center rounded-full bg-cocoa text-butter transition-colors duration-150 before:absolute before:-inset-2 hf:hover:bg-brown"
      >
        <svg viewBox="0 0 12 12" className="size-3.5" fill="currentColor" aria-hidden>
          {wantPlay ? (
            <>
              <rect x="2.5" y="2" width="2.6" height="8" rx="0.9" />
              <rect x="6.9" y="2" width="2.6" height="8" rx="0.9" />
            </>
          ) : (
            <path d="M4 2.6v6.8L10 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
