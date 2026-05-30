import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import type { SaveState } from "@/components/SavedIndicator";

export type Profile = Record<string, unknown> & { user_id: string };

const READ_ONLY_KEYS = new Set(["user_id", "created_at", "updated_at"]);

export const profileKey = (userId: string) => ["profile", userId] as const;

export const profileQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: profileKey(userId ?? "anon"),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as Profile | null;
    },
    staleTime: 30_000,
  });

/**
 * Optimistic profile editor with debounced autosave.
 *
 * - `data` is the local working copy (instant updates, no flash).
 * - `set(key, value)` mutates local state and queues an autosave.
 * - `flush()` forces the pending save immediately (call on tab switch/unload).
 * - `saveState` powers <SavedIndicator />.
 */
export function useProfileEditor() {
  const { user } = useUser();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [data, setData] = useState<Profile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const pendingPatchRef = useRef<Record<string, unknown>>({});
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed local state once on first load (and when user changes).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const result = await queryClient.fetchQuery(profileQueryOptions(userId));
      if (!cancelled && result) setData(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, queryClient]);

  const mutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!userId) throw new Error("Not signed in");
      const { error: e } = await supabase
        .from("profile")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("user_id", userId);
      if (e) throw new Error(e.message);
      return patch;
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: profileKey(userId) });
      setSaveState("saved");
      setError(null);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
    },
    onError: (e: Error) => {
      setSaveState("error");
      setError(e.message);
    },
  });

  const performSave = useCallback(() => {
    const patch = pendingPatchRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatchRef.current = {};
    setSaveState("saving");
    mutation.mutate(patch);
  }, [mutation]);

  const { debounced: debouncedSave, flush: flushDebounce, cancel: cancelDebounce } =
    useDebouncedCallback(performSave, 800);

  const set = useCallback(
    (key: string, value: unknown) => {
      if (READ_ONLY_KEYS.has(key)) return;
      setData((prev) => (prev ? { ...prev, [key]: value } : prev));
      pendingPatchRef.current[key] = value;
      setSaveState("dirty");
      debouncedSave();
    },
    [debouncedSave],
  );

  // Save immediately on tab close to avoid losing in-flight edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingPatchRef.current).length > 0) {
        flushDebounce();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushDebounce]);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const flush = useCallback(() => flushDebounce(), [flushDebounce]);
  const reset = useCallback(() => {
    cancelDebounce();
    pendingPatchRef.current = {};
    setSaveState("idle");
  }, [cancelDebounce]);

  return { data, set, flush, reset, saveState, error, isLoading: !data };
}
