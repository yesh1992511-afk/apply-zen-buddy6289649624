import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { SaveState } from "@/components/SavedIndicator";
import { toastError } from "@/lib/toast";

/**
 * Section-scoped autosave engine.
 *
 * - `values` is the local working copy (instant updates).
 * - `set(key, value)` mutates local state, validates the section, and queues a save.
 * - `flush()` saves now (call from onBlur / beforeunload).
 * - `errors` is keyed by field name for inline <FieldError /> rendering.
 */
export function useAutosaveSection<Values extends Record<string, unknown>>({
  schema,
  initial,
  onSave,
  debounceMs = 800,
}: {
  schema: z.ZodType<Values> | z.ZodObject<z.ZodRawShape>;
  initial: Values | null;
  onSave: (patch: Partial<Values>) => Promise<void>;
  debounceMs?: number;
}) {
  const [values, setValues] = useState<Values | null>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pendingRef = useRef<Partial<Values>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef(initial);

  // Re-seed when the upstream value first arrives.
  useEffect(() => {
    if (initial && !initialRef.current) {
      initialRef.current = initial;
      setValues(initial);
    } else if (initial && !values) {
      setValues(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const validate = useCallback(
    (next: Values) => {
      const result = schema.safeParse(next);
      if (!result.success) {
        const map: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = String(issue.path[0] ?? "_");
          if (!map[key]) map[key] = issue.message;
        }
        setErrors(map);
        return false;
      }
      setErrors({});
      return true;
    },
    [schema],
  );

  const performSave = useCallback(async () => {
    const patch = pendingRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingRef.current = {};
    setSaveState("saving");
    try {
      await onSave(patch);
      setSaveState("saved");
      setError(null);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setSaveState("error");
      setError(msg);
      toastError(e);
    }
  }, [onSave]);

  const {
    debounced,
    flush: flushDebounce,
    cancel,
  } = useDebouncedCallback(() => void performSave(), debounceMs);

  const set = useCallback(
    <K extends keyof Values>(key: K, value: Values[K]) => {
      setValues((prev) => {
        const next = { ...(prev ?? ({} as Values)), [key]: value } as Values;
        const valid = validate(next);
        if (valid) {
          pendingRef.current[key] = value;
          setSaveState("dirty");
          debounced();
        }
        return next;
      });
    },
    [debounced, validate],
  );

  const flush = useCallback(() => flushDebounce(), [flushDebounce]);

  // Save in-flight edits on tab close.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (Object.keys(pendingRef.current).length > 0) flushDebounce();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushDebounce]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      cancel();
    },
    [cancel],
  );

  return { values, set, flush, saveState, error, errors, isLoading: !values };
}
