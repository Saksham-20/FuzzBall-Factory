/** A call to an outside service did not answer in time. The outcome on the other side is UNKNOWN (it may have succeeded). */
export class TimeoutError extends Error {
  constructor(
    readonly what: string,
    readonly ms: number,
  ) {
    super(`${what} timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

/** Rejects with a TimeoutError if `work` has not settled after `ms`. The underlying call is not cancelled. */
export function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(what, ms)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Retries `attempt` (idempotent, side-effect free calls only: reads) with a short growing pause.
 * Never wrap a create/refund with this.
 */
export async function retryRead<T>(attempt: () => Promise<T>, opts: { tries?: number; baseDelayMs?: number } = {}): Promise<T> {
  const tries = opts.tries ?? 3;
  const base = opts.baseDelayMs ?? 250;
  let last: unknown;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await attempt();
    } catch (err) {
      last = err;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, base * 2 ** i + Math.random() * base));
    }
  }
  throw last;
}
