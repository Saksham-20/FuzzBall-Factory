import * as Sentry from '@sentry/node';

let enabled = false;

export interface ErrorReportingOptions {
  dsn: string | undefined;
  environment: string;
  release?: string;
}

/** Starts Sentry when a DSN is configured. Without one every `reportError` is a no-op, so dev and tests need nothing. */
export function initErrorReporting({ dsn, environment, release }: ErrorReportingOptions): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: 0,
    // Money and account data never leave the server: drop request bodies, cookies and auth headers before sending.
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.query_string;
      }
      return event;
    },
  });
  enabled = true;
  return true;
}

export interface ErrorContext {
  /** Where it came from: `payments`, `refunds`, `jobs`, `http`. Alert rules key off this tag. */
  area: string;
  extra?: Record<string, unknown>;
}

/** Sends an error worth a human's attention (money, background work, unexpected 500s). Never throws. */
export function reportError(err: unknown, { area, extra }: ErrorContext): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), { tags: { area }, extra });
  } catch {
    // Reporting must never take a request or a job down with it.
  }
}

/** Sends everything buffered, then stops. Call before the process exits. */
export async function flushErrorReporting(timeoutMs = 2000): Promise<void> {
  if (enabled) await Sentry.close(timeoutMs);
}
