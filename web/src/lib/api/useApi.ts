"use client";

import { useCallback, useEffect, useState } from "react";

interface State<T> {
  key: string;
  data?: T;
  error?: Error;
}

/**
 * Tiny data hook for the mock/real API layer.
 * `loading` is derived (never set synchronously in an effect).
 * Pass a stable `key` that changes whenever the inputs change.
 */
export function useApi<T>(fn: () => Promise<T>, key: string, enabled = true) {
  const [state, setState] = useState<State<T>>({ key: "" });
  const [tick, setTick] = useState(0);
  const full = `${key}#${tick}`;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fn().then(
      (data) => alive && setState({ key: full, data }),
      (error: Error) => alive && setState({ key: full, error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const fresh = state.key === full;
  return {
    data: fresh ? state.data : (state.data as T | undefined),
    error: fresh ? state.error : undefined,
    loading: enabled && !fresh,
    reload,
    setData: (data: T) => setState({ key: full, data }),
  };
}
