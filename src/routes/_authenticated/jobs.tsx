import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { ExternalLink, MapPin, Building2, Search, Sparkles, Send } from "lucide-react";
import { triggerApply, triggerTailor } from "@/lib/commands";

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
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Queued ${rows.length} job${rows.length > 1 ? "s" : ""} for the worker.`);
      setSelected(new Set());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Showing only jobs that passed your filters.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={queueApply} disabled={selected.size === 0}>
            Queue {selected.size > 0 ? selected.size : ""} for apply
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={String(hours)} onValueChange={(v) => v && setHours(Number(v))}>
          {windows.map((w) => (
            <ToggleGroupItem key={w.label} value={String(w.hours)}>{w.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title, company, location…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No matched jobs yet. Once the worker is running and scraping, jobs that pass your filters will show here.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((j) => {
            const isSel = selected.has(j.id);
            return (
              <Card key={j.id} className={isSel ? "ring-2 ring-primary" : ""}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="line-clamp-2 font-medium leading-snug">{j.title}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {j.company}
                      </div>
                      {j.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {j.location}{j.remote ? ` · ${j.remote}` : ""}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary">{j.score}</Badge>
                  </div>
                  {(j.salary_min || j.salary_max) && (
                    <div className="text-xs text-muted-foreground">
                      {j.salary_currency ?? "$"}{j.salary_min ?? "?"}–{j.salary_max ?? "?"}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{j.source_key}</Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" title="Preview tailored resume" onClick={() => triggerTailor(j.id)}>
                        <Sparkles className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Apply now" onClick={() => triggerApply(j.id)}>
                        <Send className="h-3 w-3" />
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <a href={j.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                      </Button>
                      <Button size="sm" variant={isSel ? "default" : "outline"} onClick={() => toggle(j.id)}>
                        {isSel ? "✓" : "+"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
