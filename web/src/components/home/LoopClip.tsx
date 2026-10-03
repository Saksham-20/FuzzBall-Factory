"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia(QUERY).matches;

/** Whose turn it is, and a count that changes on every handoff (so the same clip can take two turns in a row). */
interface Turn {
  id: string;
  n: number;
}

interface Relay {
  turn: Turn | null;
  /** Paused by the shopper, or from the start under reduced motion. */
  halted: boolean;
  register: (id: string, el: HTMLElement) => () => void;
  seen: (id: string, visible: boolean) => void;
  ended: (id: string) => void;
  /** The shopper's press: play this clip (and carry on from it), or pause them all. */
  press: (id: string, play: boolean) => void;
}

const Ctx = createContext<Relay | null>(null);

function useRelay() {
  const relay = useContext(Ctx);
  if (!relay) throw new Error("LoopClip must be inside <ClipRelay>");
  return relay;
}

/**
 * Plays its clips one at a time, in page order: each plays once through, then hands over to the next one on screen.
 * One thing moving draws the eye; four at once only compete, and one video decodes instead of four. Only clips at
 * least 40% on screen take a turn, so nothing plays off screen, and a clip stays in the running until less than 10%
 * of it is. Reduced motion starts it paused.
 */
export function ClipRelay({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => false);
  const members = useRef<{ id: string; el: HTMLElement; visible: boolean }[]>([]);
  const [turn, setTurn] = useState<Turn | null>(null);
  // null = no choice made yet: follow reduced motion. Once pressed, the choice wins.
  const [paused, setPaused] = useState<boolean | null>(null);
  const halted = paused ?? reduced;

  /** The next clip on screen after `id` in page order, wrapping round (the first on screen when `id` is null). */
  const nextAfter = useCallback((id: string | null) => {
    const list = members.current;
    const at = id ? list.findIndex((m) => m.id === id) : -1;
    for (let k = 1; k <= list.length; k++) {
      const m = list[(at + k + list.length) % list.length];
      if (m.visible) return m.id;
    }
    return null;
  }, []);

  const register = useCallback((id: string, el: HTMLElement) => {
    members.current.push({ id, el, visible: false });
    members.current.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return () => {
      members.current = members.current.filter((m) => m.id !== id);
    };
  }, []);

  // Observers report in no fixed order, and a row of clips comes on screen in one frame: the turn is chosen once
  // they all have (next frame), so the first in page order takes it rather than whichever reported first.
  const pick = useRef(0);
  useEffect(() => () => cancelAnimationFrame(pick.current), []);
  const seen = useCallback(
    (id: string, visible: boolean) => {
      const m = members.current.find((x) => x.id === id);
      if (!m || m.visible === visible) return;
      m.visible = visible;
      cancelAnimationFrame(pick.current);
      pick.current = requestAnimationFrame(() =>
        setTurn((t) => {
          if (t && members.current.find((x) => x.id === t.id)?.visible) return t; // the clip playing is still on screen
          const next = nextAfter(t?.id ?? null);
          return next ? { id: next, n: (t?.n ?? 0) + 1 } : null;
        }),
      );
    },
    [nextAfter],
  );

  const ended = useCallback(
    (id: string) =>
      setTurn((t) => {
        if (t?.id !== id) return t;
        const next = nextAfter(id);
        return next ? { id: next, n: t.n + 1 } : null;
      }),
    [nextAfter],
  );

  const press = useCallback((id: string, play: boolean) => {
    setPaused(!play);
    if (play) setTurn((t) => ({ id, n: (t?.n ?? 0) + 1 }));
  }, []);

  const relay = useMemo<Relay>(() => ({ turn, halted, register, seen, ended, press }), [turn, halted, register, seen, ended, press]);
  return <Ctx.Provider value={relay}>{children}</Ctx.Provider>;
}

interface Props {
  src: string;
  poster: string;
  /** What the clip shows, for the video's label and the play button. */
  label: string;
  className?: string;
  /** Laid over the clip, under its button (badges). */
  children?: ReactNode;
}

/**
 * A short silent clip that takes its turn in a <ClipRelay>. The button is WCAG 2.2.2's way out of motion that keeps
 * going: pausing stops the whole relay, and playing a clip starts the relay again from that one. It sits above a
 * card's stretched link (z-10), and has the same look as the tape's.
 */
export function LoopClip({ src, poster, label, className, children }: Props) {
  const { turn, halted, register, seen, ended, press } = useRelay();
  const id = useId();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const off = register(id, el);
    // Where the clip sits, not where its entrance moves it: measured on the box around its scroll reveal (the shelf's
    // drop-in moves each card 28px, a row at staggered times), so a row's clips come on screen together and the
    // first in page order takes the first turn. In at 40% on screen, out below 10%: a small scroll never hands the
    // turn on mid-clip.
    const box = el.closest("[data-reveal]")?.parentElement ?? el;
    let visible = false;
    const io = new IntersectionObserver(
      ([e]) => {
        const ratio = e.isIntersecting ? e.intersectionRatio : 0;
        const next = visible ? ratio >= 0.1 : ratio >= 0.4;
        if (next === visible) return;
        visible = next;
        seen(id, next);
      },
      { threshold: [0, 0.1, 0.4] },
    );
    io.observe(box);
    return () => {
      io.disconnect();
      off();
    };
  }, [id, register, seen]);

  const on = turn?.id === id && !halted;
  const n = turn?.n;
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    // A clip that has ended starts again from the top when played.
    if (on) void el.play().catch(() => {});
    else el.pause();
  }, [on, n]);

  return (
    <div className={className}>
      <video
        ref={video}
        src={src}
        poster={poster}
        aria-label={label}
        muted
        playsInline
        preload="none"
        disablePictureInPicture
        disableRemotePlayback
        onEnded={() => ended(id)}
        className="absolute inset-0 size-full object-cover"
      />
      {children}
      <button
        type="button"
        aria-label={on ? `Pause video: ${label}` : `Play video: ${label}`}
        onClick={() => press(id, !on)}
        className="press absolute right-2 bottom-2 z-10 grid size-7 place-items-center rounded-full bg-cocoa text-butter transition-colors duration-150 before:absolute before:-inset-2 hf:hover:bg-brown"
      >
        <svg viewBox="0 0 12 12" className="size-3.5" fill="currentColor" aria-hidden>
          {on ? (
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
