import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ExternalLink, MapPin, Building2, Search, Send, Briefcase, Plus, Check, FileText, Clock, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PortalBadge } from "@/components/PortalBadge";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { JobDescriptionDialog, type JobDialogJob } from "@/components/JobDescriptionDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";
import { jobsQueryOptions, jobCountsQueryOptions, savedFiltersQueryOptions, useApplyToJob, useBulkQueueApplies, useClearAllJobs, useRescoreAllJobs, useLoosenActiveFilter, useDisableNoisySources, useDailyApplyBudget } from "@/lib/queries/jobs";
import { Link } from "@tanstack/react-router";
import { AllApplicationsTable } from "@/components/AllApplicationsTable";
import { RunBatchButton } from "@/components/RunBatchButton";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({ meta: [{ title: "Jobs — JobPilot" }] }),
  component: JobsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

// `Job` type is re-exported from the query module.


const windows = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
  { label: "All", hours: 0 },
];

function scoreChip(s: number) {
  // Gradient ramp: red < 60 → amber 60–84 → emerald ≥ 85
  if (s >= 85) return "bg-gradient-to-br from-emerald-500/30 to-emerald-700/40 text-emerald-200 ring-1 ring-emerald-400/40 shadow-[0_0_12px_-2px_oklch(0.65_0.16_162/0.5)]";
  if (s >= 60) return "bg-gradient-to-br from-amber-500/25 to-amber-700/30 text-amber-200 ring-1 ring-amber-400/30";
  return "bg-gradient-to-br from-rose-500/15 to-rose-700/20 text-rose-200/90 ring-1 ring-rose-400/20";
}

type AppStatusMeta = { label: string; chip: string };
function appStatusMeta(s: string | null): AppStatusMeta | null {
  if (!s) return null;
  switch (s) {
    case "applied":
      return { label: "Applied", chip: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30" };
    case "queued":
      return { label: "Queued", chip: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30" };
    case "applying":
      return { label: "Applying…", chip: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40 animate-pulse" };
    case "needs_review":
      return { label: "Needs review", chip: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30" };
    case "failed":
      return { label: "Failed", chip: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30" };
    case "skipped":
      return { label: "Skipped", chip: "bg-muted/40 text-muted-foreground ring-1 ring-border/60" };
    default:
      return { label: s, chip: "bg-muted/40 text-muted-foreground ring-1 ring-border/60" };
  }
}

function jdSnippet(j: { description?: string | null; description_html?: string | null }): string | null {
  const raw = j.description?.trim();
  if (raw) return raw.replace(/\s+/g, " ").trim() || null;
  const html = j.description_html?.trim();
  if (!html) return null;
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  return stripped || null;
}

function JobsPage() {
  const navigate = useNavigate();
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogJob, setDialogJob] = useState<JobDialogJob | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  const jobsQuery = useQuery(jobsQueryOptions({ hours }));
  const countsQuery = useQuery(jobCountsQueryOptions());
  const filtersQuery = useQuery(savedFiltersQueryOptions());
  const applyMutation = useApplyToJob();
  const bulkQueue = useBulkQueueApplies();
  const clearAll = useClearAllJobs();
  const rescore = useRescoreAllJobs();
  const loosen = useLoosenActiveFilter();
  const disableNoisy = useDisableNoisySources();
  const budgetQuery = useDailyApplyBudget();
  const atCap = budgetQuery.data?.atCap ?? false;
  const capLabel = budgetQuery.data ? `${budgetQuery.data.used}/${budgetQuery.data.cap} today` : "";

  const jobs = jobsQuery.data ?? [];
  const savedFilters = filtersQuery.data ?? [];
  const loading = jobsQuery.isLoading;
  const applyingId = applyMutation.isPending ? applyMutation.variables ?? null : null;

  const filtered = useMemo(() => {
    if (!search) return jobs;
    const s = search.toLowerCase();
    return jobs.filter((j) =>
      j.title.toLowerCase().includes(s) ||
      j.company.toLowerCase().includes(s) ||
      (j.location ?? "").toLowerCase().includes(s)
    );
  }, [jobs, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const queueApply = () => {
    if (selected.size === 0) return;
    bulkQueue.mutate([...selected], {
      onSuccess: () => setSelected(new Set()),
    });
  };

  const applyOne = (job: { id: string }) => {
    applyMutation.mutate(job.id, {
      onSuccess: ({ id }) => {
        setDialogJob(null);
        navigate({ to: "/applications/$id", params: { id } });
      },
    });
  };



  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Jobs"
        description={`${filtered.length} matched · sorted by relevance score`}
        actions={
          <div className="flex items-center gap-2">
            <RunBatchButton defaultTarget={10} />
            <Button variant="outline" size="sm" onClick={() => rescore.mutate()} disabled={rescore.isPending} className="gap-1.5">
              {rescore.isPending ? "Re-scoring…" : "Re-score"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" disabled={clearAll.isPending}>
                  <Trash2 className="h-4 w-4" />
                  {clearAll.isPending ? "Clearing…" : "Clear all"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all scraped jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes every scraped job on your account, along with any queued applications and job-tied logs. New scrapes will use your current filters.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearAll.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              onClick={queueApply}
              disabled={selected.size === 0 || atCap}
              title={atCap ? `Daily apply cap reached (${capLabel})` : undefined}
              className="bg-gradient-emerald gap-1.5 shadow-glow disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
              {atCap ? "Daily cap reached" : `Queue ${selected.size > 0 ? selected.size : ""} apply`}
            </Button>
          </div>
        }
      />


      <div className="sticky top-14 z-10 -mx-4 px-4 py-3 md:-mx-6 md:px-6 surface-frost rounded-none border-x-0 border-y border-border/40 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={String(hours)} onValueChange={(v) => v && setHours(Number(v))} className="bg-surface-2 rounded-lg p-0.5">
            {windows.map((w) => (
              <ToggleGroupItem key={w.label} value={String(w.hours)} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md text-xs">
                {w.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title, company, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-surface-2 border-border/60"
            />
          </div>
          <Button variant="outline" onClick={() => jobsQuery.refetch()} disabled={jobsQuery.isFetching} aria-label="Refresh jobs">{jobsQuery.isFetching ? "…" : "Refresh"}</Button>
        </div>
        {savedFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 mr-1">Saved</span>
            <button
              onClick={() => { setActiveFilterId(null); setSearch(""); }}
              className={cn(
                "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-all ease-apple",
                activeFilterId === null
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-border/50 bg-surface-2/60 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >All</button>
            {savedFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFilterId(f.id);
                  setSearch((f.keywords ?? []).join(" "));
                }}
                className={cn(
                  "h-6 rounded-full border px-2.5 text-[11px] font-medium transition-all ease-apple",
                  activeFilterId === f.id
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border/50 bg-surface-2/60 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >{f.name}</button>
            ))}
          </div>
        )}
      </div>


      {countsQuery.data && countsQuery.data.scraped > 50 && countsQuery.data.matched === 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-heading font-semibold text-sm">
                Scraped {countsQuery.data.scraped.toLocaleString()} jobs but matched 0
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your filter is too strict, or several enabled sources aren't pre-filtering by keyword. Try one of these:
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => loosen.mutate(undefined, { onSuccess: () => rescore.mutate() })} disabled={loosen.isPending || rescore.isPending}>
                  {loosen.isPending || rescore.isPending ? "Working…" : "Loosen filter + re-score"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => disableNoisy.mutate()} disabled={disableNoisy.isPending}>
                  {disableNoisy.isPending ? "Disabling…" : "Disable noisy sources"}
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/filters">Edit filter manually</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {jobsQuery.isError ? (
        <QueryErrorState error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} title="Couldn't load jobs" />
      ) : loading && jobs.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[180px] shimmer rounded-xl" />
          ))}
        </div>

      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No matched jobs in this window"
          description="Once the worker scrapes and your filters match, qualified jobs will land here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((j, idx) => {
            const isSel = selected.has(j.id);
            const appMeta = appStatusMeta(j.application_status);
            const isApplied = j.application_status === "applied";
            const isInFlight = j.application_status === "queued" || j.application_status === "applying";
            const isRetryable = j.application_status === "failed" || j.application_status === "needs_review";
            return (
              <div
                key={j.id}
                style={{ animationDelay: `${Math.min(idx * 30, 360)}ms` }}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-elegant row-in lift",
                  isSel ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "border-border/60",
                )}
              >

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-medium text-foreground/80">{j.company}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3 w-3" />{timeAgo(j.posted_at ?? j.scraped_at)}
                      </span>
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 font-heading text-[15px] font-semibold leading-snug">{j.title}</h3>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className={cn("rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums", scoreChip(j.score))}>
                      {j.score}
                    </div>
                    {appMeta && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", appMeta.chip)}>
                        {appMeta.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {j.location && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3" />{j.location}{j.remote ? ` · ${j.remote}` : ""}
                    </span>
                  )}
                  {j.seniority && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">{j.seniority}</span>}
                  {j.employment_type && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">{j.employment_type}</span>}
                </div>
                {(j.salary_min || j.salary_max) && (
                  <div className="mt-2 inline-flex w-fit items-center rounded bg-gold/10 text-gold px-2 py-0.5 text-[11px] font-medium tabular-nums">
                    {j.salary_currency ?? "$"}{j.salary_min ?? "?"}–{j.salary_max ?? "?"}
                  </div>
                )}
                {(() => {
                  const snip = jdSnippet(j);
                  return snip ? (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground/90">{snip}</p>
                  ) : null;
                })()}

                <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/50 mt-3">
                  <div className="flex items-center gap-2">
                    <PortalBadge source={j.source_key} size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setDialogJob(j as JobDialogJob)} className="h-8 gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5" />Description
                    </Button>
                    {(isApplied || isInFlight) && j.application_id ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Link to="/applications/$id" params={{ id: j.application_id }}>
                          <Send className="h-3.5 w-3.5" />{isApplied ? "View" : "In progress"}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => applyOne(j)}
                        disabled={applyingId === j.id || atCap}
                        title={atCap ? `Daily apply cap reached (${capLabel})` : undefined}
                        className="h-8 gap-1.5 text-xs bg-gradient-emerald shadow-glow"
                      >
                        <Send className="h-3.5 w-3.5" />{applyingId === j.id ? "…" : atCap ? "Cap" : isRetryable ? "Retry" : "Apply"}
                      </Button>
                    )}

                    <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <a href={j.url} target="_blank" rel="noreferrer" title="Open job">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant={isSel ? "default" : "ghost"}
                      onClick={() => toggle(j.id)}
                      title={isSel ? "Selected" : "Add to batch"}
                      className={cn("h-8 w-8 p-0", isSel && "bg-primary")}
                    >
                      {isSel ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AllApplicationsTable />

      <JobDescriptionDialog
        job={dialogJob}
        open={!!dialogJob}
        onOpenChange={(v) => !v && setDialogJob(null)}
        onApply={applyOne}
        applying={!!applyingId}
      />
    </div>
  );
}
