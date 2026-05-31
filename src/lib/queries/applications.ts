import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastError, toastSaved } from "@/lib/toast";

export type ApplicationEvent = {
  id: number;
  ts: string;
  phase: string;
  status: string | null;
  message: string | null;
  screenshot_path: string | null;
  payload: Record<string, unknown>;
};

export const applicationEventsKey = (id: string) =>
  ["application", id, "events"] as const;

export const applicationEventsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: applicationEventsKey(id),
    queryFn: async (): Promise<ApplicationEvent[]> => {
      const { data, error } = await supabase
        .from("application_events")
        .select("id, ts, phase, status, message, screenshot_path, payload")
        .eq("application_id", id)
        .order("ts", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as ApplicationEvent[];
    },
    staleTime: 5_000,
  });

/** Retry a failed / DLQ application: clear error, schedule next run now. */
export function useRetryApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("applications")
        .update({
          next_retry_at: new Date().toISOString(),
          last_error: null,
          dlq_reason: null,
          status: "queued",
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      // Best-effort kick; read counts so we can surface skipped/requeued
      const { data: { session } } = await supabase.auth.getSession();
      const summary = session?.access_token
        ? await fetch(`/api/public/hooks/apply-worker?application_id=${id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : null;
      return { id, summary } as { id: string; summary: { counts?: Record<string, number> } | null };
    },
    onSuccess: ({ id, summary }) => {
      const c = summary?.counts ?? {};
      const parts: string[] = [];
      if (c.ok) parts.push(`${c.ok} ok`);
      if (c.requeued) parts.push(`${c.requeued} requeued`);
      if (c.skipped) parts.push(`${c.skipped} skipped (already running)`);
      if (c.failed) parts.push(`${c.failed} failed`);
      toastSaved(parts.length ? `Retry: ${parts.join(", ")}` : "Retry queued");
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toastError(e),
  });
}
