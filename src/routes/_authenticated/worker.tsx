import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { LiveDot } from "@/components/LiveDot";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/worker")({
  head: () => ({ meta: [{ title: "Worker — JobPilot" }] }),
  component: WorkerPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
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
type Run = {
  id: string;
  kind: string;
  source_key: string | null;
  status: string;
  items_in: number | null;
  items_out: number | null;
  errors: number | null;
  started_at: string;
  finished_at: string | null;
};
type SourceHealth = {
  key: string;
  display_name: string;
  enabled: boolean;
  cadence_minutes: number;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_count: number | null;
  last_error: string | null;
};

const QUICK_COMMANDS: Array<{ kind: string; label: string; description: string }> = [
  { kind: "refresh_sources", label: "Refresh sources", description: "Wake the worker and re-read enabled sources" },
  { kind: "run_due_sources", label: "Run sources now", description: "Force a scrape tick on the VPS" },
  { kind: "drain_apply_queue", label: "Drain apply queue", description: "Process all queued applications" },
  { kind: "test_apply", label: "Dry-run apply", description: "Run an apply flow against a fake job for diagnostics" },
];

function fmtAge(ms: number): string {
  if (!isFinite(ms)) return "never";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function tone(ms: number): string {
  if (ms < 30_000) return "bg-emerald-500";
  if (ms < 5 * 60_000) return "bg-amber-500";
  return "bg-red-500";
}

function WorkerPage() {
  const [hb, setHb] = useState<HB | null>(null);
  const [cmds, setCmds] = useState<Cmd[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [srcHealth, setSrcHealth] = useState<SourceHealth[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const load = async () => {
    try {
      const [hbRes, cmdRes, runRes, srcRes] = await Promise.all([
        supabase.from("worker_heartbeat").select("last_seen, version").maybeSingle(),
        supabase
          .from("worker_commands")
          .select("id, kind, status, created_at, started_at, finished_at, last_error, payload")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("automation_runs")
          .select("id, kind, source_key, status, items_in, items_out, errors, started_at, finished_at")
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("sources")
          .select("key, display_name, enabled, cadence_minutes, last_run_at, last_run_status, last_run_count, last_error")
          .order("display_name"),
      ]);

      const firstError = hbRes.error || cmdRes.error || runRes.error || srcRes.error;
      if (firstError) {
        setLoadError(firstError.message);
        return;
      }
      setLoadError(null);
      setHb(hbRes.data as HB);
      setCmds((cmdRes.data ?? []) as Cmd[]);
      setRuns((runRes.data ?? []) as Run[]);
      setSrcHealth((srcRes.data ?? []) as SourceHealth[]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => { load(); }, []);
  useRealtimeInvalidate({ table: "worker_heartbeat", onChange: load });
  useRealtimeInvalidate({ table: "worker_commands", onChange: load });
  useRealtimeInvalidate({ table: "automation_runs", onChange: load });

  const send = async (kind: string) => {
    setSending(kind);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not signed in"); return; }
      const { error } = await supabase.from("worker_commands").insert({
        user_id: user.id,
        kind,
        payload: {},
        status: "pending",
      });
      if (error) toast.error(`Couldn't queue command: ${error.message}`);
      else toast.success(`Queued: ${kind}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(null);
    }
  };

  // Apply worker = VPS heartbeat
  const applyAgeMs = hb?.last_seen ? Date.now() - new Date(hb.last_seen).getTime() : Infinity;
  // Scraper = most recent scrape-style run
  const lastScrape = runs.find((r) => r.kind === "scrape" || r.source_key) ?? runs[0];
  const scrapeAgeMs = lastScrape ? Date.now() - new Date(lastScrape.started_at).getTime() : Infinity;

  const fmtDur = (a: string, b: string | null) => {
    if (!b) return "running…";
    const ms = new Date(b).getTime() - new Date(a).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms / 1000 / 60)}m`;
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight flex items-center gap-3">
            <LiveDot /> Worker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Health of scraping (Lovable Cloud) and auto-apply (your VPS).
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-red-300">Couldn't load worker status</div>
            <div className="mt-1 font-mono text-xs text-red-200/80 break-all">{loadError}</div>
          </div>
        </div>
      )}

      {/* What runs where — collapsible help */}
      <div className="rounded-2xl border border-border/60 bg-card">
        <button
          onClick={() => setHelpOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-surface-2/40 transition-colors rounded-2xl"
        >
          {helpOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-heading text-sm font-semibold">What runs where?</span>
          <span className="text-xs text-muted-foreground ml-1">
            Why some things need your VPS and others don't
          </span>
        </button>
        {helpOpen && (
          <div className="px-5 pb-5 pt-1 space-y-3 text-sm text-muted-foreground">
            <div>
              <span className="text-foreground font-medium">Scraping (Lovable Cloud)</span> — public job
              boards (Greenhouse, Lever, Apify, USAJobs, etc.) are pulled directly by this app on a
              schedule. No VPS required.
            </div>
            <div>
              <span className="text-foreground font-medium">Auto-apply worker (your VPS)</span> — actually
              filling out application forms needs a real Chromium browser, captcha solving, and OAuth
              login state, which can't run on Lovable's edge runtime. This is the Python worker in{" "}
              <code className="text-foreground bg-surface-2 px-1.5 py-0.5 rounded text-xs">/root/jobpilot/worker</code>.
            </div>
            <div>
              <span className="text-foreground font-medium">Red dot but pushed to GitHub?</span> The
              dashboard reads <span className="text-foreground">live database state</span>, not GitHub
              files. Your VPS must <code className="text-foreground bg-surface-2 px-1.5 py-0.5 rounded text-xs">git pull</code>{" "}
              and restart the worker (now automatic — see <code className="text-foreground bg-surface-2 px-1.5 py-0.5 rounded text-xs">worker/README.md</code> "Auto-deploy from GitHub").
            </div>
            <div>
              <span className="text-foreground font-medium">Secrets in <code className="bg-surface-2 px-1.5 py-0.5 rounded text-xs">.env.example</code>?</span> That file is a
              template only. Real secrets must be in <code className="text-foreground bg-surface-2 px-1.5 py-0.5 rounded text-xs">worker/.env</code>{" "}
              on the VPS, or added via the Setup page for Lovable-side runs.
            </div>
          </div>
        )}
      </div>

      {/* Two heartbeats: scraper vs apply worker */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Scraper (Lovable Cloud)</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={"inline-block h-2 w-2 rounded-full " + tone(scrapeAgeMs) + (scrapeAgeMs < 30_000 ? " animate-pulse" : "")} />
            <span className="font-heading text-2xl tabular-nums">{fmtAge(scrapeAgeMs)}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {lastScrape ? `Last: ${lastScrape.source_key ?? lastScrape.kind}` : "No runs recorded yet"}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Apply worker (VPS)</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={"inline-block h-2 w-2 rounded-full " + tone(applyAgeMs) + (applyAgeMs < 30_000 ? " animate-pulse" : "")} />
            <span className="font-heading text-2xl tabular-nums">{fmtAge(applyAgeMs)}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground font-mono">
            {hb?.version ?? "no version reported"}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Commands queued</div>
          <div className="mt-2 font-heading text-2xl tabular-nums">
            {cmds.filter((c) => c.status === "pending").length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {cmds.filter((c) => c.status === "failed").length} failed in last 50
          </div>
        </div>
      </div>

      {/* Per-source health */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-heading text-base font-semibold mb-3">Source health</h2>
        {srcHealth.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources configured yet.</p>
        ) : (
          <div className="space-y-1 max-h-[360px] overflow-y-auto">
            {srcHealth.map((s) => {
              const age = s.last_run_at ? Date.now() - new Date(s.last_run_at).getTime() : Infinity;
              const overdue = s.enabled && age > s.cadence_minutes * 60_000 * 2;
              const t = !s.enabled
                ? "bg-zinc-500"
                : s.last_run_status === "ok"
                  ? overdue ? "bg-amber-500" : "bg-emerald-500"
                  : s.last_run_status === "failed" ? "bg-red-500" : "bg-zinc-500";
              return (
                <div key={s.key} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className={"inline-block h-1.5 w-1.5 rounded-full " + t} />
                  <span className="font-medium w-44 shrink-0 truncate">{s.display_name}</span>
                  <span className="text-muted-foreground w-20 shrink-0">{s.enabled ? `${s.cadence_minutes}m` : "off"}</span>
                  <span className="text-muted-foreground tabular-nums w-28 shrink-0">
                    {s.last_run_at ? new Date(s.last_run_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never"}
                  </span>
                  <span className="text-muted-foreground tabular-nums w-12 shrink-0">{s.last_run_count ?? "—"}</span>
                  {s.last_error && <span className="text-red-400 truncate flex-1" title={s.last_error}>{s.last_error}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="font-heading text-base font-semibold mb-3">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="space-y-1 max-h-[360px] overflow-y-auto">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className={"inline-block h-1.5 w-1.5 rounded-full " + (r.status === "ok" ? "bg-emerald-500" : r.status === "failed" ? "bg-red-500" : "bg-amber-500 animate-pulse")} />
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums w-32 shrink-0">{new Date(r.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="font-medium w-32 shrink-0">{r.source_key ?? r.kind}</span>
                <span className="text-muted-foreground capitalize w-16 shrink-0">{r.status}</span>
                <span className="text-muted-foreground tabular-nums w-16 shrink-0">{fmtDur(r.started_at, r.finished_at)}</span>
                <span className="text-muted-foreground tabular-nums">in {r.items_in ?? 0} · out {r.items_out ?? 0}{r.errors ? ` · err ${r.errors}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick commands */}
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

      {/* Recent commands */}
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
                    (c.status === "done" ? "bg-emerald-500" :
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
