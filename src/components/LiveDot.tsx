import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { cn } from "@/lib/utils";

/**
 * Tiny live "worker online" indicator. Subscribes to worker_heartbeat
 * realtime and refreshes the last_seen timestamp.
 */
export function LiveDot({ className }: { className?: string }) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("worker_heartbeat")
      .select("last_seen")
      .maybeSingle();
    setLastSeen(data?.last_seen ?? null);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useRealtimeInvalidate({
    table: "worker_heartbeat",
    onChange: () => load(),
  });

  const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Infinity;
  const online = ageMs < 90_000;
  const stale = !online && ageMs < 5 * 60_000;
  const color = online
    ? "bg-emerald-500 shadow-[0_0_8px_theme(colors.emerald.500)]"
    : stale
      ? "bg-amber-500"
      : "bg-zinc-500";

  return (
    <span
      title={
        lastSeen
          ? `Worker last seen ${Math.round(ageMs / 1000)}s ago`
          : "Worker has never reported in"
      }
      className={cn(
        "inline-block h-2 w-2 rounded-full transition-colors",
        color,
        className,
      )}
    />
  );
}
