import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Opts = {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string; // e.g. "user_id=eq.<uuid>"
  queryKey?: QueryKey;
  onChange?: (payload: unknown) => void;
};

/**
 * Subscribe to postgres_changes on a Supabase table and invalidate a
 * TanStack Query key (or run a callback) whenever a row changes.
 *
 * Cleans up on unmount. Safe to mount multiple times — each instance
 * gets its own channel.
 */
export function useRealtimeInvalidate({
  table,
  event = "*",
  filter,
  queryKey,
  onChange,
}: Opts) {
  const qc = useQueryClient();

  useEffect(() => {
    const channelName = `rt:${table}:${filter ?? "all"}:${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        { event, schema: "public", table, ...(filter ? { filter } : {}) } as never,
        (payload: unknown) => {
          if (queryKey) qc.invalidateQueries({ queryKey });
          onChange?.(payload);
        },
      )
      .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, filter, JSON.stringify(queryKey)]);
}
