const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls `check` until it answers true or `timeoutMs` passes. A check that throws counts as "not yet". Resolves whether it succeeded. */
export async function waitUntil(
  check: () => Promise<boolean>,
  opts: { timeoutMs: number; everyMs: number; sleep?: (ms: number) => Promise<void> },
): Promise<boolean> {
  const sleep = opts.sleep ?? pause;
  let waited = 0;
  for (;;) {
    try {
      if (await check()) return true;
    } catch {
      // Network blip: keep waiting.
    }
    if (waited >= opts.timeoutMs) return false;
    await sleep(opts.everyMs);
    waited += opts.everyMs;
  }
}
