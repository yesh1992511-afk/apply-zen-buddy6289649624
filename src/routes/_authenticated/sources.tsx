import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { triggerScrape, triggerTestSource } from "@/lib/commands";
import { waitForCommand } from "@/lib/commands";
import { Play, FlaskConical, Database, Trash2, Plus, CheckCircle2, AlertCircle, Loader2, Target, KeyRound, PackagePlus } from "lucide-react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { PACKS, configFieldFor, mergePackIntoConfig } from "@/lib/sources/curated-packs";

import { PageHeader } from "@/components/PageHeader";
import { PortalBadge } from "@/components/PortalBadge";
import { EmptyState } from "@/components/EmptyState";
import { BusyOverlay, SourceRowSkeleton } from "@/components/skeletons";
import { timeAgo } from "@/lib/timeAgo";
import {
  JOB_TARGET_PRESETS,
  applyTargetToSourceConfig,
  findPreset,
  type JobTarget,
} from "@/lib/jobTarget";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({ meta: [{ title: "Sources — JobPilot" }] }),
  component: SourcesPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type Source = {
  id: string;
  key: string;
  display_name: string;
  kind: "apify" | "rest" | "board";
  enabled: boolean;
  cadence_minutes: number;
  config: Record<string, unknown>;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_count: number | null;
  last_error: string | null;
};

// Note: worker uses a unified config schema {queries, locations, rows, remote}.
// Per-source keyword/location values get filled in from the active Job Target
// at seed time (and overwritten by "Apply" later) — no more hard-coded
// "software engineer".
const PRESETS: Array<Omit<Source, "id" | "enabled" | "last_run_at" | "last_run_status" | "last_run_count" | "last_error">> = [
  // Paid Apify actors (LinkedIn / Indeed / ZipRecruiter / Glassdoor / Google / Wellfound)
  { key: "apify_linkedin", display_name: "LinkedIn (Apify)", kind: "apify", cadence_minutes: 60, config: { rows: 50, published_at: "r86400" } },
  { key: "apify_indeed", display_name: "Indeed (Apify)", kind: "apify", cadence_minutes: 60, config: { rows: 50, country: "US" } },
  { key: "apify_ziprecruiter", display_name: "ZipRecruiter (Apify)", kind: "apify", cadence_minutes: 120, config: { rows: 50 } },
  { key: "apify_glassdoor", display_name: "Glassdoor (Apify)", kind: "apify", cadence_minutes: 120, config: { rows: 50 } },
  { key: "apify_google_jobs", display_name: "Google Jobs (Apify)", kind: "apify", cadence_minutes: 60, config: { rows: 50 } },
  { key: "apify_wellfound", display_name: "Wellfound / AngelList (Apify)", kind: "apify", cadence_minutes: 180, config: { rows: 50 } },
  // Free REST / RSS APIs
  { key: "remoteok", display_name: "RemoteOK (free)", kind: "rest", cadence_minutes: 60, config: {} },
  { key: "remotive", display_name: "Remotive (free)", kind: "rest", cadence_minutes: 60, config: {} },
  { key: "arbeitnow", display_name: "Arbeitnow (free)", kind: "rest", cadence_minutes: 60, config: {} },
  { key: "weworkremotely", display_name: "We Work Remotely (free)", kind: "rest", cadence_minutes: 120, config: { category: "remote-programming-jobs" } },
  { key: "usajobs", display_name: "USAJobs (federal, free)", kind: "rest", cadence_minutes: 240, config: {} },
  { key: "builtin", display_name: "BuiltIn (US tech)", kind: "rest", cadence_minutes: 120, config: { rows: 50 } },
  { key: "workatastartup", display_name: "YC Work At A Startup (free)", kind: "rest", cadence_minutes: 240, config: { rows: 50 } },
  // Direct ATS boards (public APIs, no proxy needed)
  { key: "greenhouse_boards", display_name: "Greenhouse boards", kind: "board", cadence_minutes: 180, config: { companies: ["stripe", "airbnb"] } },
  { key: "lever_boards", display_name: "Lever boards", kind: "board", cadence_minutes: 180, config: { companies: ["netflix"] } },
  { key: "ashby_boards", display_name: "Ashby boards", kind: "board", cadence_minutes: 180, config: { boards: ["openai"] } },
  { key: "smartrecruiters_boards", display_name: "SmartRecruiters boards", kind: "board", cadence_minutes: 180, config: { companies: ["Square", "Bosch"] } },
  { key: "workable_boards", display_name: "Workable boards", kind: "board", cadence_minutes: 180, config: { subdomains: [] } },
  { key: "recruitee_boards", display_name: "Recruitee boards", kind: "board", cadence_minutes: 240, config: { companies: [] } },
  { key: "teamtailor_boards", display_name: "Teamtailor boards", kind: "board", cadence_minutes: 240, config: { companies: [], api_keys: {} } },
];


const DEFAULT_TARGET: JobTarget = {
  field: "cybersecurity",
  titles: findPreset("cybersecurity")!.titles,
  locations: findPreset("cybersecurity")!.locations,
  country: findPreset("cybersecurity")!.country,
  postedWithinHours: findPreset("cybersecurity")!.postedWithinHours,
  excludeKeywords: findPreset("cybersecurity")!.excludeKeywords,
};

function SourcesPage() {
  const { user } = useUser();
  const [sources, setSources] = useState<Source[]>([]);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [ingestionEnabled, setIngestionEnabled] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [lastIngestResult, setLastIngestResult] = useState<string | null>(null);
  const [target, setTarget] = useState<JobTarget>(DEFAULT_TARGET);
  const [applyingTarget, setApplyingTarget] = useState(false);
  const [secretNames, setSecretNames] = useState<Set<string>>(new Set());

  const load = () => {
    supabase.from("sources").select("*").order("display_name").then(({ data }) => setSources((data ?? []) as Source[]));
    supabase
      .from("automation_settings")
      .select("enabled, target_titles, target_locations, target_country, target_posted_within_hours, target_exclude_keywords")
      .maybeSingle()
      .then(({ data }) => {
        setIngestionEnabled(!!data?.enabled);
        if (data && (data.target_titles?.length ?? 0) > 0) {
          setTarget({
            field: "custom",
            titles: data.target_titles ?? [],
            locations: data.target_locations ?? ["United States"],
            country: data.target_country ?? "US",
            postedWithinHours: data.target_posted_within_hours ?? 168,
            excludeKeywords: data.target_exclude_keywords ?? [],
          });
        }
      });
    supabase.from("secrets_meta").select("name,status").then(({ data }) => {
      const names = new Set((data ?? []).filter((s) => s.status === "set").map((s) => s.name));
      setSecretNames(names);
    });
  };
  useEffect(() => { load(); }, []);
  useRealtimeInvalidate({ table: "sources", onChange: load });

  const loadPack = async (s: Source) => {
    const field = configFieldFor(s.key);
    if (!field) { toast.error("Pack not supported for this source"); return; }
    const { config, added } = mergePackIntoConfig(s.key as keyof typeof PACKS.cybersecurity.data, s.config, "cybersecurity");
    if (added === 0) { toast.info("All companies in the pack are already configured"); return; }
    const { error } = await supabase.from("sources").update({ config } as never).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Added ${added} compan${added === 1 ? "y" : "ies"} to ${s.display_name}`);
    load();
  };


  // First-visit autopilot: if the user has zero sources, seed + enable everything
  // and create a permissive default filter so jobs aren't all dropped.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: srcCount }, { count: filterCount }] = await Promise.all([
        supabase.from("sources").select("id", { count: "exact", head: true }),
        supabase.from("filters").select("id", { count: "exact", head: true }),
      ]);
      if ((filterCount ?? 0) === 0) {
        await supabase.from("filters").insert({
          user_id: user.id,
          name: "Default",
          is_default: true,
          min_score: 30,
          posted_within_hours: 168,
          remote_only: false,
          onsite_ok: true,
          hybrid_ok: true,
        } as never);
      }
      if ((srcCount ?? 0) === 0) {
        const rows = PRESETS.map((p) => ({
          ...p,
          config: applyTargetToSourceConfig(p.key, p.config, target),
          user_id: user.id,
          enabled: true,
        }));
        await supabase.from("sources").insert(rows as never);
        toast.success(`Seeded ${rows.length} sources — enabled by default`);
        load();
      }
    })();
  }, [user]);

  const toggleIngestion = async (v: boolean) => {
    if (!user) return;
    setIngestionEnabled(v);
    // automation_settings is auto-created by handle_new_user trigger, but upsert to be safe
    const { error } = await supabase.from("automation_settings").upsert({ user_id: user.id, enabled: v } as never, { onConflict: "user_id" });
    if (error) { toast.error(error.message); setIngestionEnabled(!v); return; }
    toast.success(v ? "Job ingestion enabled — first batch incoming" : "Ingestion paused");
    if (v) runNow();
  };

  const runNow = async () => {
    if (!user) return;
    setRunningNow(true);
    setLastIngestResult(null);
    try {
      const res = await fetch(`/api/public/sources/run-tier?tier=hot&user_id=${user.id}`);
      const json = await res.json() as { ok?: boolean; summary?: Record<string, { fetched: number; inserted: number }> };
      if (!json.ok) { toast.error("Run failed"); return; }
      const totals = Object.values(json.summary ?? {}).reduce((a, b) => ({ fetched: a.fetched + b.fetched, inserted: a.inserted + b.inserted }), { fetched: 0, inserted: 0 });
      setLastIngestResult(`Fetched ${totals.fetched} jobs · ${totals.inserted} new`);
      toast.success(`Fetched ${totals.fetched} jobs · ${totals.inserted} new`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunningNow(false);
    }
  };

  const seed = async () => {
    if (!user) return;
    const existing = new Set(sources.map((s) => s.key));
    const rows = PRESETS.filter((p) => !existing.has(p.key)).map((p) => ({
      ...p,
      config: applyTargetToSourceConfig(p.key, p.config, target),
      user_id: user.id,
      enabled: true,
    }));
    if (rows.length === 0) { toast.info("All presets already added"); return; }
    const { error } = await supabase.from("sources").insert(rows as never);
    if (error) toast.error(error.message); else { toast.success(`Seeded ${rows.length} sources`); load(); }
  };

  const applyTarget = async () => {
    if (!user) return;
    if (target.titles.length === 0) { toast.error("Add at least one title/keyword"); return; }
    setApplyingTarget(true);
    try {
      // 1) Persist target on automation_settings
      const { error: asErr } = await supabase.from("automation_settings").upsert({
        user_id: user.id,
        target_titles: target.titles,
        target_locations: target.locations,
        target_country: target.country,
        target_posted_within_hours: target.postedWithinHours,
        target_exclude_keywords: target.excludeKeywords,
      } as never, { onConflict: "user_id" });
      if (asErr) throw asErr;

      // 2) Rewrite every source's config in-place
      const updates = sources.map((s) => ({
        id: s.id,
        config: applyTargetToSourceConfig(s.key, s.config, target),
      }));
      for (const u of updates) {
        await supabase.from("sources").update({ config: u.config } as never).eq("id", u.id);
      }

      // 3) Update (or create) default filter to match
      const { data: defaultFilter } = await supabase
        .from("filters").select("id").eq("is_default", true).maybeSingle();
      const filterPatch = {
        keywords: target.titles,
        exclude_keywords: target.excludeKeywords,
        locations: target.locations,
        posted_within_hours: target.postedWithinHours,
        min_score: 35,
      };
      if (defaultFilter?.id) {
        await supabase.from("filters").update(filterPatch as never).eq("id", defaultFilter.id);
      } else {
        await supabase.from("filters").insert({
          ...filterPatch,
          user_id: user.id,
          name: findPreset(target.field)?.label ?? "Default",
          is_default: true,
          remote_only: false,
          onsite_ok: true,
          hybrid_ok: true,
        } as never);
      }

      toast.success(`Target applied to ${updates.length} sources + default filter`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply target");
    } finally {
      setApplyingTarget(false);
    }
  };



  const update = async (id: string, patch: Partial<Source>) => {
    const prev = sources;
    setSources((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("sources").update(patch as never).eq("id", id);
    if (error) {
      setSources(prev);
      toast.error(error.message);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("sources").delete().eq("id", id);
    load();
  };

  const runTest = async (s: Source) => {
    setTesting((t) => ({ ...t, [s.id]: true }));
    try {
      const cid = await triggerTestSource(s.key);
      if (!cid) return;
      const res = await waitForCommand(cid, 90_000);
      if (res?.status === "done") {
        const r = res.result as { ok?: boolean; fetched?: number; new_jobs?: number; error?: string } | null;
        if (r?.ok) toast.success(`Fetched ${r.fetched ?? 0} · ${r.new_jobs ?? 0} new`);
        else toast.error(`Test failed: ${r?.error ?? "unknown"}`);
      } else {
        toast.error(`Test failed: ${res?.last_error ?? "timeout"}`);
      }
      load();
    } finally {
      setTesting((t) => ({ ...t, [s.id]: false }));
    }
  };

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Sources"
        description={`${enabledCount} of ${sources.length} active · Where jobs are scraped from`}
        actions={
          <Button onClick={seed} variant="outline" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add presets
          </Button>
        }
      />

      {/* Job Target — drives keywords across every source + default filter */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-card to-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Target className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-heading font-semibold">Job target</h3>
            <p className="text-xs text-muted-foreground">
              One place to set what jobs you want — applies to every source's search keywords and your default filter.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Field</Label>
            <select
              value={target.field}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "custom") { setTarget((t) => ({ ...t, field: "custom" })); return; }
                const p = findPreset(v);
                if (p) setTarget({
                  field: p.field, titles: p.titles, locations: p.locations,
                  country: p.country, postedWithinHours: p.postedWithinHours,
                  excludeKeywords: p.excludeKeywords,
                });
              }}
              className="mt-1.5 w-full rounded-md border border-border/60 bg-surface-2 px-3 py-2 text-sm"
            >
              {JOB_TARGET_PRESETS.map((p) => (
                <option key={p.field} value={p.field}>{p.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Location</Label>
            <Input
              value={target.locations[0] ?? ""}
              onChange={(e) => setTarget((t) => ({ ...t, locations: [e.target.value], field: "custom" }))}
              placeholder="United States"
              className="mt-1.5 bg-surface-2 border-border/60"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Titles / keywords (comma-separated)
            </Label>
            <Textarea
              rows={3}
              value={target.titles.join(", ")}
              onChange={(e) => setTarget((t) => ({
                ...t,
                field: "custom",
                titles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              }))}
              placeholder="cybersecurity, SOC analyst, penetration tester, ..."
              className="mt-1.5 bg-surface-2 border-border/60 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Exclude keywords (comma-separated)
            </Label>
            <Input
              value={target.excludeKeywords.join(", ")}
              onChange={(e) => setTarget((t) => ({
                ...t,
                field: "custom",
                excludeKeywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              }))}
              placeholder="recruiter, intern, sales, physical security, ..."
              className="mt-1.5 bg-surface-2 border-border/60"
            />
          </div>
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Country code</Label>
            <Input
              value={target.country}
              onChange={(e) => setTarget((t) => ({ ...t, country: e.target.value, field: "custom" }))}
              placeholder="US"
              className="mt-1.5 bg-surface-2 border-border/60"
            />
          </div>
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Posted within (hours)</Label>
            <Input
              type="number"
              value={target.postedWithinHours}
              onChange={(e) => setTarget((t) => ({ ...t, postedWithinHours: Number(e.target.value) || 168, field: "custom" }))}
              className="mt-1.5 bg-surface-2 border-border/60"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Applies to all {sources.length} sources + your default filter. Existing jobs already in your feed are not re-scored.
          </p>
          <Button onClick={applyTarget} disabled={applyingTarget} className="bg-gradient-emerald gap-1.5">
            {applyingTarget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
            Apply to all sources + filter
          </Button>
        </div>
      </div>


      {/* Prominent ingestion controls */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${ingestionEnabled ? "bg-success/20" : "bg-surface-2"}`}>
              {ingestionEnabled ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Database className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <h3 className="font-heading font-semibold">Auto job ingestion</h3>
              <p className="text-xs text-muted-foreground">
                {ingestionEnabled
                  ? "Pulling from 6 aggregators every 15 min + 25+ career pages hourly"
                  : "Enable to start receiving jobs in your dashboard automatically"}
              </p>
              {lastIngestResult && <p className="text-xs text-primary mt-0.5">{lastIngestResult}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={runNow} disabled={runningNow} variant="outline" className="gap-1.5">
              {runningNow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {runningNow ? "Running…" : "Run now"}
            </Button>
            <div className="flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5">
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${ingestionEnabled ? "text-success" : "text-muted-foreground"}`}>
                {ingestionEnabled ? "ON" : "OFF"}
              </span>
              <Switch checked={ingestionEnabled} onCheckedChange={toggleIngestion} />
            </div>
          </div>
        </div>
      </div>

      {(() => {
        const enabledApify = sources.filter((s) => s.enabled && s.kind === "apify");
        const enabledUsajobs = sources.find((s) => s.enabled && s.key === "usajobs");
        const missing: Array<{ key: string; label: string; unlocks: string; href: string }> = [];
        if (enabledApify.length > 0 && !secretNames.has("APIFY_TOKEN")) {
          missing.push({
            key: "APIFY_TOKEN",
            label: "APIFY_TOKEN",
            unlocks: `${enabledApify.length} Apify source${enabledApify.length === 1 ? "" : "s"} (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs, Wellfound)`,
            href: "https://console.apify.com/account/integrations",
          });
        }
        if (enabledUsajobs && (!secretNames.has("USAJOBS_API_KEY") || !secretNames.has("USAJOBS_USER_AGENT_EMAIL"))) {
          missing.push({
            key: "USAJOBS",
            label: "USAJOBS_API_KEY + USAJOBS_USER_AGENT_EMAIL",
            unlocks: "USAJobs (federal cybersecurity roles, free)",
            href: "https://developer.usajobs.gov/apirequest/Index",
          });
        }
        if (missing.length === 0) return null;
        return (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-warning shrink-0" />
              <div className="min-w-0 flex-1">
                <h4 className="font-heading font-semibold text-sm">Missing scraper keys — some portals are dark</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  These sources are enabled but can't run until you add the required keys in Setup → Secrets.
                </p>
                <ul className="mt-3 space-y-2 text-xs">
                  {missing.map((m) => (
                    <li key={m.key} className="rounded-md border border-border/60 bg-card p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <code className="font-mono text-[11px] font-semibold text-foreground">{m.label}</code>
                        <a
                          href={m.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-primary hover:underline"
                        >Where to get it →</a>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">Unlocks: {m.unlocks}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}


        <EmptyState
          icon={Database}
          title="No sources yet"
          description="Click 'Add presets' to start with the 12 most-used boards and aggregators."
          action={<Button onClick={seed} className="bg-gradient-emerald"><Plus className="mr-1 h-4 w-4" /> Add preset sources</Button>}
        />
      ) : (
        <div className="space-y-3">
          {runningNow && (
            <div className="space-y-3" aria-live="polite" aria-label="Fetching jobs from sources">
              {Array.from({ length: 3 }).map((_, i) => (
                <SourceRowSkeleton key={`run-skel-${i}`} />
              ))}
            </div>
          )}
          {sources.map((s) => {
            const statusOk = s.last_run_status === "ok" || s.last_run_status === "success";
            const statusPartial = s.last_run_status === "partial";
            // Cadence-aware staleness: even an OK source is "Stale" if it hasn't run in 2× its cadence.
            const ageMs = s.last_run_at ? Date.now() - new Date(s.last_run_at).getTime() : 0;
            const isStale = statusOk && s.enabled && s.last_run_at != null
              && ageMs > Math.max(s.cadence_minutes, 1) * 60_000 * 2;
            const healthLabel = !s.enabled
              ? "Paused"
              : !s.last_run_at
                ? "Idle"
                : isStale
                  ? "Stale"
                  : statusOk
                    ? "Healthy"
                    : statusPartial ? "Degraded" : "Failing";
            const healthClass = !s.enabled
              ? "bg-surface-3 text-muted-foreground"
              : isStale
                ? "bg-warning/15 text-warning ring-1 ring-warning/30"
                : statusOk
                  ? "bg-success/15 text-success ring-1 ring-success/30"
                  : statusPartial
                    ? "bg-warning/15 text-warning ring-1 ring-warning/30"
                    : !s.last_run_at
                      ? "bg-surface-3 text-muted-foreground"
                      : "bg-destructive/15 text-destructive ring-1 ring-destructive/30";

            return (
              <BusyOverlay key={s.id} busy={!!testing[s.id]} label="Testing…" className="rounded-xl">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-card transition-shadow hover:shadow-elegant lift">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 bg-surface-1 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <PortalBadge source={s.key} size="sm" />
                      <h3 className="font-heading font-semibold">{s.display_name}</h3>
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">{s.kind}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${healthClass}`}>{healthLabel}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {s.last_run_at ? (
                        <>
                          {statusOk ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-warning" />
                          )}
                          <span>Last sync <span className="text-foreground/80 font-medium tabular-nums">{timeAgo(s.last_run_at)}</span></span>
                          <span className="text-muted-foreground/60">·</span>
                          <span className="font-medium tabular-nums text-foreground">{s.last_run_count ?? 0}</span>
                          <span>jobs</span>
                        </>
                      ) : (
                        <span className="italic">Never run yet</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => runTest(s)} disabled={testing[s.id]} className="gap-1.5">
                      {testing[s.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                      Test
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => triggerScrape(s.key)} className="gap-1.5">
                      <Play className="h-3 w-3" /> Run now
                    </Button>
                    <div className="flex items-center gap-2 rounded-full bg-surface-2 px-2.5 py-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${s.enabled ? "text-success" : "text-muted-foreground"}`}>
                        {s.enabled ? "ON" : "OFF"}
                      </span>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) => { setSources((cur) => cur.map((x) => x.id === s.id ? { ...x, enabled: v } : x)); update(s.id, { enabled: v }); }}
                      />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-[1fr_2fr]">
                  <div>
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Cadence (minutes)</Label>
                    <Input type="number" defaultValue={s.cadence_minutes} onBlur={(e) => update(s.id, { cadence_minutes: Number(e.target.value) })} className="mt-1.5 bg-surface-2 border-border/60" />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Auto-runs every {s.cadence_minutes} minutes when enabled
                    </p>
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Config (JSON)</Label>
                    <Textarea
                      rows={5}
                      className="mt-1.5 font-mono text-xs bg-surface-2 border-border/60"
                      defaultValue={JSON.stringify(s.config, null, 2)}
                      onBlur={(e) => {
                        try { update(s.id, { config: JSON.parse(e.target.value) }); }
                        catch { toast.error("Invalid JSON"); }
                      }}
                    />
                  </div>
                  {s.last_error && (
                    <div className="md:col-span-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs font-medium text-destructive">
                        <span className="inline-flex items-center gap-2">
                          <AlertCircle className="h-3.5 w-3.5" /> Last error
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(s.last_error ?? "");
                            toast.success("Error copied");
                          }}
                          className="rounded border border-destructive/30 px-1.5 py-0.5 text-[10px] font-medium text-destructive/80 hover:bg-destructive/10"
                        >Copy</button>
                      </div>
                      <p className="mt-1 font-mono text-xs text-destructive/90 break-all">{s.last_error}</p>
                    </div>
                  )}

                </div>
              </div>
              </BusyOverlay>
            );
          })}
        </div>
      )}
    </div>
  );
}
