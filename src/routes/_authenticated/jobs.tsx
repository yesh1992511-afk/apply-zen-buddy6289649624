import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { ExternalLink, MapPin, Building2, Search, Send, Briefcase, Plus, Check, FileText, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PortalBadge } from "@/components/PortalBadge";
import { EmptyState } from "@/components/EmptyState";
import { JobDescriptionDialog, type JobDialogJob } from "@/components/JobDescriptionDialog";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({ meta: [{ title: "Jobs — JobPilot" }] }),
  component: JobsPage,
  errorComponent: ErrorBoundaryRoute,
});

type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  url: string;
  source_key: string;
  posted_at: string | null;
  scraped_at: string;
  score: number;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  employment_type: string | null;
  seniority: string | null;
  description: string | null;
  description_html: string | null;
  status: string;
};

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

function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [dialogJob, setDialogJob] = useState<JobDialogJob | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("jobs")
      .select("*")
      .eq("matched", true)
      .order("score", { ascending: false })
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (hours > 0) {
      const since = new Date(Date.now() - hours * 3600_000).toISOString();
      q = q.gte("scraped_at", since);
    }
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [hours]);

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

  const queueApply = async () => {
    if (selected.size === 0) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const rows = [...selected].map((job_id) => ({ job_id, user_id: u.user!.id, status: "queued" as const }));
    const { error } = await supabase.from("applications").insert(rows);
    if (error) toast.error(error.message);
    else {
      toast.success(`Queued ${rows.length} job${rows.length > 1 ? "s" : ""} for the worker.`);
      setSelected(new Set());
    }
  };

  const applyOne = async (job: { id: string }) => {
    setApplyingId(job.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", job.id)
        .eq("user_id", u.user.id)
        .maybeSingle();
      let appId = existing?.id;
      if (!appId) {
        const { data, error } = await supabase
          .from("applications")
          .insert({ job_id: job.id, user_id: u.user.id, status: "queued" })
          .select("id")
          .single();
        if (error) { toast.error(error.message); return; }
        appId = data.id;
        toast.success("Application queued — worker starting");
      } else {
        toast.message("Already queued — opening application");
      }
      setDialogJob(null);
      // Kick the worker immediately so user sees activity right away (don't wait for the 1-min cron)
      fetch(`/api/public/hooks/apply-worker?application_id=${appId}`, { method: "POST" }).catch(() => {});
      navigate({ to: "/applications/$id", params: { id: appId } });
    } finally {
      setApplyingId(null);
    }
  };


  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Jobs"
        description={`${filtered.length} matched · sorted by relevance score`}
        actions={
          <Button onClick={queueApply} disabled={selected.size === 0} className="bg-gradient-emerald gap-1.5 shadow-glow disabled:shadow-none">
            <Send className="h-4 w-4" />
            Queue {selected.size > 0 ? selected.size : ""} apply
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
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
        <Button variant="outline" onClick={load} disabled={loading}>{loading ? "…" : "Refresh"}</Button>
      </div>

      {loading && jobs.length === 0 ? (
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
                  <div className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums", scoreColor(j.score))}>
                    {j.score}
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

                <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/50 mt-3">
                  <div className="flex items-center gap-2">
                    <PortalBadge source={j.source_key} size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setDialogJob(j as JobDialogJob)} className="h-8 gap-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5" />Description
                    </Button>
                    <Button size="sm" onClick={() => applyOne(j)} disabled={applyingId === j.id} className="h-8 gap-1.5 text-xs bg-gradient-emerald shadow-glow">
                      <Send className="h-3.5 w-3.5" />{applyingId === j.id ? "…" : "Apply"}
                    </Button>
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
