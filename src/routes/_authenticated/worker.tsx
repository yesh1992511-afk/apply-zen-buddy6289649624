import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { LiveDot } from "@/components/LiveDot";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/worker")({
  head: () => ({ meta: [{ title: "Worker — JobPilot" }] }),
  component: WorkerPage,
  errorComponent: ErrorBoundaryRoute,
});

type HB = { last_seen: string | null; version: string | null };
type Cmd = {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  payload: Record<string, unknown> | null;
};

const QUICK_COMMANDS: Array<{ kind: string; label: string; description: string }> = [
  { kind: "refresh_sources", label: "Refresh sources", description: "Wake the worker and re-read enabled sources" },
  { kind: "run_due_sources", label: "Run sources now", description: "Force a scrape tick on the VPS" },
  { kind: "drain_apply_queue", label: "Drain apply queue", description: "Process all queued applications" },
  { kind: "test_apply", label: "Dry-run apply", description: "Run an apply flow against a fake job for diagnostics" },
];

function WorkerPage() {
  const [hb, setHb] = useState<HB | null>(null);
  const [cmds, setCmds] = useState<Cmd[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  const load = async () => {
    const [{ data: h }, { data: c }] = await Promise.all([
      supabase.from("worker_heartbeat").select("last_seen, version").maybeSingle(),
      supabase
        .from("worker_commands")
        .select("id, kind, status, created_at, started_at, finished_at, last_error, payload")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setHb(h as HB);
    setCmds((c ?? []) as Cmd[]);
  };

  useEffect(() => { load(); }, []);
  useRealtimeInvalidate({ table: "worker_heartbeat", onChange: load });
  useRealtimeInvalidate({ table: "worker_commands", onChange: load });

  const send = async (kind: string) => {
    setSending(kind);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(null); return; }
    const { error } = await supabase.from("worker_commands").insert({
      user_id: user.id,
      kind,
      payload: {},
      status: "pending",
    });
    setSending(null);
    if (error) toast.error(`Couldn't queue command: ${error.message}`);
    else toast.success(`Queued: ${kind}`);
  };

  const ageMs = hb?.last_seen ? Date.now() - new Date(hb.last_seen).getTime() : Infinity;
  const ageStr = hb?.last_seen ? `${Math.round(ageMs / 1000)}s ago` : "never";

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight flex items-center gap-3">
            <LiveDot /> Worker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Heartbeat from your VPS, plus on-demand commands.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Last seen</div>
          <div className="mt-2 font-heading text-2xl tabular-nums">{ageStr}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Version</div>
          <div className="mt-2 font-mono text-sm">{hb?.version ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Commands queued</div>
          <div className="mt-2 font-heading text-2xl tabular-nums">{cmds.filter(c => c.status === "pending").length}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-heading text-base font-semibold mb-3">Quick commands</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {QUICK_COMMANDS.map((q) => (
            <button
              key={q.kind}
              disabled={sending === q.kind}
              onClick={() => send(q.kind)}
              className="text-left rounded-lg border border-border/60 bg-surface-2 px-3 py-2.5 hover:bg-surface-3 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-medium">{q.label}</div>
              <div className="text-xs text-muted-foreground">{q.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-heading text-base font-semibold mb-3">Recent commands</h2>
        {cmds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No commands yet.</p>
        ) : (
          <div className="space-y-1 max-h-[480px] overflow-y-auto">
            {cmds.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                <span
                  className={
                    "inline-block h-1.5 w-1.5 rounded-full " +
                    (c.status === "completed" ? "bg-emerald-500" :
                     c.status === "failed" ? "bg-red-500" :
                     c.status === "running" ? "bg-amber-500 animate-pulse" : "bg-zinc-500")
                  }
                />
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums w-32 shrink-0">
                  {new Date(c.created_at).toLocaleTimeString()}
                </span>
                <span className="font-medium w-40 shrink-0">{c.kind}</span>
                <span className="text-muted-foreground capitalize w-20 shrink-0">{c.status}</span>
                {c.last_error && (
                  <span className="text-red-400 truncate" title={c.last_error}>{c.last_error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
