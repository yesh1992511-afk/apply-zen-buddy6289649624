import { useCallback, useEffect, useRef } from "react";

/**
 * Debounce a callback. The returned function keeps a stable identity and the
 * latest `fn` is always invoked, so it is safe to use inside effects.
 *
 * - `flush()`  — invoke immediately with the last queued args, if any.
 * - `cancel()` — drop any pending invocation.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay = 600,
) {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<TArgs | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (lastArgsRef.current) {
      const args = lastArgsRef.current;
      lastArgsRef.current = null;
      fnRef.current(...args);
    }
  }, []);

  const debounced = useCallback(
    (...args: TArgs) => {
      lastArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const a = lastArgsRef.current;
        lastArgsRef.current = null;
        if (a) fnRef.current(...a);
      }, delay);
    },
    [delay],
  );

  return { debounced, flush, cancel };
}
