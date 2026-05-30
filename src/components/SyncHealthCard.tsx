import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Chrome, Cookie, Server } from "lucide-react";
import { cn } from "@/lib/utils";

type Health = {
  extensionLastSeen: string | null;
  capturesToday: number;
  workerLastSeen: string | null;
  workerVersion: string | null;
  queuedApps: number;
  cookieHosts: number;
  oldestCookieDays: number | null;
};

async function fetchHealth(): Promise<Health> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) {
    return { extensionLastSeen: null, capturesToday: 0, workerLastSeen: null, workerVersion: null, queuedApps: 0, cookieHosts: 0, oldestCookieDays: null };
  }
  const [tok, hb, apps, cookies] = await Promise.all([
    supabase.from("extension_tokens").select("last_seen_at, captures_today").eq("user_id", uid),
    supabase.from("worker_heartbeat").select("last_seen, version").eq("user_id", uid).maybeSingle(),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "queued"),
    supabase.from("session_cookies").select("host, updated_at").eq("user_id", uid),
  ]);
  const extensionLastSeen = (tok.data || []).reduce<string | null>((acc, r) => {
    if (!r.last_seen_at) return acc;
    if (!acc || new Date(r.last_seen_at) > new Date(acc)) return r.last_seen_at;
    return acc;
  }, null);
  const capturesToday = (tok.data || []).reduce((n, r) => n + (r.captures_today || 0), 0);
  const cookieHosts = (cookies.data || []).length;
  const oldestCookieDays = (cookies.data || []).reduce<number | null>((acc, r) => {
    const d = (Date.now() - new Date(r.updated_at).getTime()) / 86_400_000;
    return acc === null || d > acc ? d : acc;
  }, null);
  return {
    extensionLastSeen,
    capturesToday,
    workerLastSeen: hb.data?.last_seen ?? null,
    workerVersion: hb.data?.version ?? null,
    queuedApps: apps.count ?? 0,
    cookieHosts,
    oldestCookieDays,
  };
}

function ageLabel(iso: string | null): string {
  if (!iso) return "never";
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 90) return `${Math.round(sec)}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
}

function chipTone(iso: string | null, warnMin: number, errMin: number): "ok" | "warn" | "err" {
  if (!iso) return "err";
  const min = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (min > errMin) return "err";
  if (min > warnMin) return "warn";
  return "ok";
}

export function SyncHealthCard() {
  const qc = useQueryClient();
  useRealtimeInvalidate([
    { table: "worker_heartbeat", queryKey: ["sync-health"] },
    { table: "extension_tokens", queryKey: ["sync-health"] },
    { table: "applications", queryKey: ["sync-health"] },
    { table: "session_cookies", queryKey: ["sync-health"] },
  ]);
  const { data } = useQuery({ queryKey: ["sync-health"], queryFn: fetchHealth, refetchInterval: 30_000 });
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const h = data;
  const extTone = chipTone(h?.extensionLastSeen ?? null, 60, 60 * 24);
  const wrkTone = chipTone(h?.workerLastSeen ?? null, 2, 5);
  const cookieTone: "ok" | "warn" | "err" = !h?.cookieHosts
    ? "warn"
    : (h.oldestCookieDays ?? 0) > 10
    ? "err"
    : (h.oldestCookieDays ?? 0) > 5
    ? "warn"
    : "ok";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Sync Health
        </h3>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["sync-health"] })}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Chip
          icon={<Chrome className="h-4 w-4" />}
          label="Extension"
          value={ageLabel(h?.extensionLastSeen ?? null)}
          sub={`${h?.capturesToday ?? 0} captures today`}
          tone={extTone}
        />
        <Chip
          icon={<Server className="h-4 w-4" />}
          label="Worker"
          value={ageLabel(h?.workerLastSeen ?? null)}
          sub={h?.workerVersion ? `v${h.workerVersion}` : "no heartbeat"}
          tone={wrkTone}
        />
        <Chip
          icon={<Activity className="h-4 w-4" />}
          label="Apply queue"
          value={`${h?.queuedApps ?? 0}`}
          sub={(h?.queuedApps ?? 0) > 0 ? "pending" : "idle"}
          tone={(h?.queuedApps ?? 0) > 50 ? "warn" : "ok"}
        />
        <Chip
          icon={<Cookie className="h-4 w-4" />}
          label="Sessions"
          value={`${h?.cookieHosts ?? 0} hosts`}
          sub={
            h?.cookieHosts
              ? `oldest ${Math.round(h.oldestCookieDays ?? 0)}d`
              : "no cookies synced"
          }
          tone={cookieTone}
        />
      </div>
    </div>
  );
}

function Chip({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "ok" | "warn" | "err";
}) {
  const dot =
    tone === "ok" ? "bg-success" : tone === "warn" ? "bg-warning" : "bg-destructive";
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <span className={cn("h-2 w-2 rounded-full", dot)} />
      </div>
      <div className="text-base font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
