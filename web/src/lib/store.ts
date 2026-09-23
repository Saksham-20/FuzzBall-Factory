/**
 * Tiny localStorage-backed store for use with useSyncExternalStore.
 * Server snapshot is always `initial`, so hydration never mismatches.
 */
export function createPersistedStore<T>(key: string, initial: T) {
  let state = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  function load() {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = JSON.parse(raw) as T;
    } catch {
      /* private mode / bad JSON: fall back to initial */
    }
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      try {
        state = e.newValue ? (JSON.parse(e.newValue) as T) : initial;
      } catch {
        state = initial;
      }
      emit();
    });
  }

  return {
    subscribe(cb: () => void) {
      load();
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot() {
      load();
      return state;
    },
    getServerSnapshot() {
      return initial;
    },
    set(next: T | ((s: T) => T)) {
      load();
      state = typeof next === "function" ? (next as (s: T) => T)(state) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage full or blocked: keep in-memory state */
      }
      emit();
    },
  };
}
