import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, Send, CheckCircle2, AlertTriangle, Activity, Clock, ArrowUpRight,
  Sparkles, TrendingUp, Database, DollarSign,
} from "lucide-react";
import { MetricTile } from "@/components/MetricTile";
import { StatusDot } from "@/components/StatusDot";
import { EmptyState } from "@/components/EmptyState";
import { CountUp } from "@/components/CountUp";
import { CardSkeleton, Skeleton } from "@/components/skeletons";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { LiveDot } from "@/components/LiveDot";
import { SyncHealthCard } from "@/components/SyncHealthCard";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";



export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — JobPilot" }] }),
  component: Dashboard,
  errorComponent: ErrorBoundaryRoute,
});

type Stats = {
  jobsToday: number;
  matchedToday: number;
  appliedToday: number;
  failedToday: number;
  queued: number;
  total: number;
};

type LogRow = {
  id: number;
  ts: string;
  level: string;
  scope: string | null;
  message: string;
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [heartbeat, setHeartbeat] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [automation, setAutomation] = useState<{ enabled: boolean; max_applies_per_day: number; run_24_7: boolean; daily_start: string | null; daily_end: string | null } | null>(null);
  const [recent, setRecent] = useState<LogRow[]>([]);
  const [perPortal, setPerPortal] = useState<Record<string, number>>({});
  const [mtdSpend, setMtdSpend] = useState<Array<{ provider: string; total_cost: number }> | null>(null);

  const load = () => {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    Promise.all([
      supabase.from("jobs").select("id", { count: "exact", head: true }).gte("scraped_at", sinceIso),
      supabase.from("jobs").select("id", { count: "exact", head: true }).gte("scraped_at", sinceIso).eq("matched", true),
      supabase.from("applications").select("id", { count: "exact", head: true }).gte("applied_at", sinceIso).eq("status", "applied"),
      supabase.from("applications").select("id", { count: "exact", head: true }).gte("updated_at", sinceIso).eq("status", "failed"),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "queued"),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("worker_heartbeat").select("last_seen,version").maybeSingle(),
      supabase.from("automation_settings").select("enabled,max_applies_per_day,run_24_7,daily_start,daily_end").maybeSingle(),
      supabase.from("logs").select("id,ts,level,scope,message").order("ts", { ascending: false }).limit(12),
      supabase.from("applications").select("jobs(source_key)").gte("applied_at", sinceIso).eq("status", "applied"),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return { data: [] as Array<{ provider: string; total_cost: number }> };
        return supabase.rpc("usage_mtd_by_provider", { _user_id: user.id }) as unknown as { data: Array<{ provider: string; total_cost: number }> };
      }),
    ]).then(([j, m, a, f, q, t, hb, auto, lg, portals, spend]) => {
      setStats({
        jobsToday: j.count ?? 0,
        matchedToday: m.count ?? 0,
        appliedToday: a.count ?? 0,
        failedToday: f.count ?? 0,
        queued: q.count ?? 0,
        total: t.count ?? 0,
      });
      setHeartbeat(hb.data?.last_seen ?? null);
      setVersion(hb.data?.version ?? null);
      setAutomation(auto.data ?? null);
      setRecent((lg.data ?? []) as LogRow[]);
      const counts: Record<string, number> = {};
      const rows = (portals.data ?? []) as Array<{ jobs: { source_key: string | null } | null }>;
      rows.forEach((row) => {
        const p = row.jobs?.source_key ?? "other";
        counts[p] = (counts[p] ?? 0) + 1;
      });
      setPerPortal(counts);
      setMtdSpend((spend as { data?: Array<{ provider: string; total_cost: number }> })?.data ?? []);
    });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  // Realtime nervous system: refresh on any relevant table change.
  useRealtimeInvalidate({ table: "jobs", onChange: load });
  useRealtimeInvalidate({ table: "applications", onChange: load });
  useRealtimeInvalidate({ table: "worker_heartbeat", onChange: load });
  useRealtimeInvalidate({ table: "logs", onChange: load });


  const workerOk = heartbeat && Date.now() - new Date(heartbeat).getTime() < 5 * 60_000;
  const workerStatus: "online" | "warning" | "offline" = !heartbeat
    ? "offline"
    : workerOk
      ? "online"
      : "warning";
  const lastSeen = heartbeat ? new Date(heartbeat) : null;
  const lastSeenAgo = lastSeen
    ? `${Math.max(0, Math.round((Date.now() - lastSeen.getTime()) / 1000))}s ago`
    : "never";

  const budget = automation?.max_applies_per_day ?? 0;
  const used = stats?.appliedToday ?? 0;
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const ringOffset = circ - (pct / 100) * circ;

  // Funnel calculation
  const funnel = [
    { label: "Discovered", value: stats?.jobsToday ?? 0 },
    { label: "Matched", value: stats?.matchedToday ?? 0 },
    { label: "Queued", value: stats?.queued ?? 0 },
    { label: "Applied", value: stats?.appliedToday ?? 0 },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  const portalList = ["greenhouse", "linkedin", "lever", "workday", "indeed"];
  const portalMax = Math.max(1, ...Object.values(perPortal));

  // Active window
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const minutesOfDay = now.getHours() * 60 + now.getMinutes();
  const parseTime = (t: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const startMin = automation?.run_24_7 ? 0 : parseTime(automation?.daily_start ?? null) ?? 9 * 60;
  const endMin = automation?.run_24_7 ? 24 * 60 : parseTime(automation?.daily_end ?? null) ?? 18 * 60;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 float-in">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight flex items-center gap-3">
            <LiveDot /> Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live snapshot of your job hunt autopilot.
          </p>
        </div>

        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-2 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring"
        >
          View all jobs
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <SyncHealthCard />



      {!stats && (
        <div className="grid gap-5 md:grid-cols-6 lg:grid-cols-12">
          <div className="col-span-full lg:col-span-6 h-[280px] shimmer rounded-2xl" />
          <CardSkeleton className="col-span-3 md:col-span-3 lg:col-span-3 h-[280px]" />
          <CardSkeleton className="col-span-3 md:col-span-3 lg:col-span-3 h-[280px]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} className="col-span-3 md:col-span-3 lg:col-span-3" />
          ))}
        </div>
      )}

      {stats && (
      <div className="grid gap-5 md:grid-cols-6 lg:grid-cols-12">

        {/* HERO — daily progress */}
        <div className="relative col-span-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-hero p-6 md:col-span-6 lg:col-span-6">
          <div className="absolute inset-0 bg-gradient-to-br from-card/40 via-card/20 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              Today
            </div>
            <div className="mt-6 flex items-center gap-6">
              <div className="relative h-[100px] w-[100px] shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r={radius} fill="none"
                    stroke={pct >= 90 ? "var(--destructive)" : "var(--gold)"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 600ms ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-heading text-xl font-semibold tabular-nums">{used}</span>
                  <span className="text-[10px] text-muted-foreground">/ {budget || "∞"}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="font-heading text-5xl font-semibold tabular-nums tracking-tight">
                  <CountUp value={used} />
                </div>

                <p className="mt-1 text-sm text-muted-foreground">applications today</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {budget > 0 ? (
                    <>
                      <span className="text-gold font-medium tabular-nums">{pct}%</span> of daily cap
                    </>
                  ) : (
                    "No cap set"
                  )}
                </p>
              </div>
            </div>

            {/* Active window */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-medium uppercase tracking-wider">
                  {automation?.run_24_7 ? "Always on" : "Active window"}
                </span>
                <span className="tabular-nums">{tz}</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="absolute h-full bg-primary/40"
                  style={{ left: `${(startMin / 1440) * 100}%`, width: `${((endMin - startMin) / 1440) * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-gold"
                  style={{ left: `${(minutesOfDay / 1440) * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground/70">
                <span>00:00</span><span>12:00</span><span>24:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heartbeat tile */}
        <div className="col-span-3 h-full rounded-2xl border border-border/60 bg-card p-5 md:col-span-3 lg:col-span-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Worker</div>
              <div className="mt-3 flex items-center gap-2">
                <StatusDot status={workerStatus} size="lg" />
                <span className="font-heading text-2xl font-semibold capitalize">{workerStatus === "warning" ? "Stale" : workerStatus}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">Last seen {lastSeenAgo}</p>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          {version && (
            <div className="mt-4 rounded-md bg-surface-2 px-2 py-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">v{version}</span>
            </div>
          )}
        </div>

        {/* Per-portal tile */}
        <div className="col-span-3 h-full rounded-2xl border border-border/60 bg-card p-5 md:col-span-3 lg:col-span-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Today by portal</div>
          <div className="mt-4 space-y-2">
            {portalList.map((p) => {
              const v = perPortal[p] ?? 0;
              const w = (v / portalMax) * 100;
              return (
                <div key={p} className="flex items-center gap-2 text-xs">
                  <span className="w-16 capitalize text-muted-foreground">{p}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="absolute h-full bg-primary/80"
                      style={{ width: `${w}%`, transition: "width 600ms ease" }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums font-medium">{v}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric strip */}
        <MetricTile className="col-span-3 md:col-span-2 lg:col-span-3" label="Jobs scraped" value={stats?.jobsToday} hint="today" icon={Briefcase} />
        <MetricTile className="col-span-3 md:col-span-2 lg:col-span-3" label="Matched" value={stats?.matchedToday} hint="passed filters" icon={TrendingUp} accent="success" />
        <MetricTile className="col-span-3 md:col-span-2 lg:col-span-3" label="Queued" value={stats?.queued} hint="awaiting apply" icon={Clock} />
        <MetricTile className="col-span-3 md:col-span-2 lg:col-span-3" label="Failed" value={stats?.failedToday} hint="today" icon={AlertTriangle} accent={stats?.failedToday ? "danger" : "default"} />

        {/* Month-to-date spend */}
        <div className="col-span-full rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-heading text-sm font-semibold">Month-to-date spend</h3>
            </div>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              ${(mtdSpend ?? []).reduce((sum, r) => sum + Number(r.total_cost ?? 0), 0).toFixed(2)}
            </span>
          </div>
          {!mtdSpend || mtdSpend.length === 0 ? (
            <p className="text-xs text-muted-foreground">No usage recorded yet this month.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {mtdSpend.map((r) => (
                <div key={r.provider} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
                  <span className="text-xs capitalize text-muted-foreground">{r.provider}</span>
                  <span className="font-mono text-xs tabular-nums">${Number(r.total_cost ?? 0).toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-full rounded-2xl border border-border/60 bg-card p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-semibold">Pipeline funnel</h3>
              <p className="text-xs text-muted-foreground">Discovered → applied, today</p>
            </div>
          </div>
          <div className="space-y-3">
            {funnel.map((f) => {
              const w = (f.value / funnelMax) * 100;
              return (
                <div key={f.label}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="font-heading text-lg font-semibold tabular-nums">{f.value}</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="absolute h-full rounded-full bg-gradient-emerald"
                      style={{ width: `${w}%`, transition: "width 600ms ease" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>Total jobs in database</span>
            <span className="font-medium tabular-nums text-foreground">{stats?.total ?? 0}</span>
          </div>
        </div>

        {/* Recent activity */}
        <div className="col-span-full rounded-2xl border border-border/60 bg-card p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base font-semibold">Recent activity</h3>
              <p className="text-xs text-muted-foreground">Last 12 events</p>
            </div>
            <Link to="/logs" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No events yet"
              description="Once the worker starts running, activity will appear here."
            />
          ) : (
            <div className="-mx-1 max-h-[360px] space-y-0.5 overflow-y-auto pr-1">
              {recent.map((r, i) => {
                const colorCls =
                  r.level === "error" ? "bg-destructive" :
                  r.level === "warn" ? "bg-warning" :
                  r.level === "info" ? "bg-success" : "bg-muted-foreground";
                return (
                  <div
                    key={r.id}
                    style={{ animationDelay: `${Math.min(i * 25, 240)}ms` }}
                    className="row-in group flex items-start gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-surface-2"
                  >

                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${colorCls}`} />
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/80 whitespace-nowrap pt-1">
                      {new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {r.scope && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {r.scope}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 break-words leading-tight">{r.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

