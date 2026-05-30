import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  description: string | null;
  status: string;
};

const windows = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
  { label: "All", hours: 0 },
];

function scoreColor(s: number) {
  if (s >= 80) return "bg-gradient-gold text-gold-foreground";
  if (s >= 60) return "bg-success/20 text-success border border-success/30";
  return "bg-surface-3 text-muted-foreground";
}

function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

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

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No matched jobs in this window"
          description="Once the worker scrapes and your filters match, qualified jobs will land here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((j) => {
            const isSel = selected.has(j.id);
            const postedDays = j.posted_at
              ? Math.max(0, Math.round((Date.now() - new Date(j.posted_at).getTime()) / 86_400_000))
              : null;
            return (
              <div
                key={j.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-elegant",
                  isSel ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "border-border/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-heading text-[15px] font-semibold leading-snug">{j.title}</h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="truncate">{j.company}</span>
                    </div>
                  </div>
                  <div className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums", scoreColor(j.score))}>
                    {j.score}
                  </div>
                </div>
                {j.location && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{j.location}{j.remote ? ` · ${j.remote}` : ""}</span>
                  </div>
                )}
                {(j.salary_min || j.salary_max) && (
                  <div className="mt-2 inline-flex items-center rounded bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-foreground tabular-nums">
                    {j.salary_currency ?? "$"}{j.salary_min ?? "?"}–{j.salary_max ?? "?"}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                  <div className="flex items-center gap-2">
                    <PortalBadge source={j.source_key} size="sm" />
                    {postedDays !== null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">{postedDays}d ago</span>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    <Button size="sm" variant="ghost" title="Tailor resume" onClick={() => triggerTailor(j.id)} className="h-8 w-8 p-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Apply now" onClick={() => triggerApply(j.id)} className="h-8 w-8 p-0">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <a href={j.url} target="_blank" rel="noreferrer" title="Open job">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant={isSel ? "default" : "outline"}
                      onClick={() => toggle(j.id)}
                      className={cn("h-8 w-8 p-0 ml-1", isSel && "bg-primary")}
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
    </div>
  );
}
