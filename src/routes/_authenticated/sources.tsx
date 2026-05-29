import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({ meta: [{ title: "Sources — JobPilot" }] }),
  component: SourcesPage,
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

const PRESETS: Array<Omit<Source, "id" | "enabled" | "last_run_at" | "last_run_status" | "last_run_count" | "last_error">> = [
  { key: "apify_linkedin", display_name: "LinkedIn (Apify)", kind: "apify", cadence_minutes: 60, config: { actor_id: "bebity~linkedin-jobs-scraper", maxItems: 50, searchTerms: ["software engineer"], locations: ["United States"], publishedAt: "r86400" } },
  { key: "apify_indeed", display_name: "Indeed (Apify)", kind: "apify", cadence_minutes: 60, config: { actor_id: "misceres~indeed-scraper", maxItems: 50, position: "software engineer", country: "US" } },
  { key: "apify_ziprecruiter", display_name: "ZipRecruiter (Apify)", kind: "apify", cadence_minutes: 120, config: { actor_id: "bebity~zip-recruiter-scraper", maxItems: 50, search: "software engineer" } },
  { key: "apify_dice", display_name: "Dice (Apify)", kind: "apify", cadence_minutes: 120, config: { actor_id: "epctex~dice-scraper", maxItems: 50, keywords: "software engineer" } },
  { key: "remoteok", display_name: "RemoteOK (free)", kind: "rest", cadence_minutes: 60, config: { keywords: ["python", "typescript"] } },
  { key: "remotive", display_name: "Remotive (free)", kind: "rest", cadence_minutes: 60, config: { search: "software" } },
  { key: "adzuna", display_name: "Adzuna (free API)", kind: "rest", cadence_minutes: 60, config: { country: "us", what: "software engineer", where: "" } },
  { key: "jooble", display_name: "Jooble (free API)", kind: "rest", cadence_minutes: 60, config: { keywords: "software engineer", location: "" } },
  { key: "usajobs", display_name: "USAJobs (free)", kind: "rest", cadence_minutes: 240, config: { keyword: "software" } },
  { key: "greenhouse_boards", display_name: "Greenhouse boards", kind: "board", cadence_minutes: 180, config: { companies: ["stripe", "airbnb"] } },
  { key: "lever_boards", display_name: "Lever boards", kind: "board", cadence_minutes: 180, config: { companies: ["netflix"] } },
  { key: "ashby_boards", display_name: "Ashby boards", kind: "board", cadence_minutes: 180, config: { companies: ["openai"] } },
];

function SourcesPage() {
  const { user } = useUser();
  const [sources, setSources] = useState<Source[]>([]);

  const load = () => {
    supabase.from("sources").select("*").order("display_name").then(({ data }) => setSources((data ?? []) as Source[]));
  };
  useEffect(() => { load(); }, []);

  const seed = async () => {
    if (!user) return;
    const existing = new Set(sources.map((s) => s.key));
    const rows = PRESETS.filter((p) => !existing.has(p.key)).map((p) => ({ ...p, user_id: user.id, enabled: false }));
    if (rows.length === 0) { toast.info("All presets already added"); return; }
    const { error } = await supabase.from("sources").insert(rows);
    if (error) toast.error(error.message); else { toast.success(`Seeded ${rows.length} sources`); load(); }
  };

  const update = async (id: string, patch: Partial<Source>) => {
    const { error } = await supabase.from("sources").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    await supabase.from("sources").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="text-sm text-muted-foreground">Configure where the worker scrapes jobs from.</p>
        </div>
        <Button onClick={seed} variant="outline">Add preset sources</Button>
      </div>

      {sources.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No sources configured. Click "Add preset sources" to start.</CardContent></Card>
      )}

      <div className="space-y-3">
        {sources.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {s.display_name}
                  <Badge variant="outline" className="text-[10px]">{s.kind}</Badge>
                  <Badge variant="outline" className="text-[10px]">{s.key}</Badge>
                </CardTitle>
                <CardDescription>
                  {s.last_run_at ? <>Last run: {new Date(s.last_run_at).toLocaleString()} · {s.last_run_status} · {s.last_run_count ?? 0} jobs</> : "Never run yet"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={s.enabled} onCheckedChange={(v) => { setSources((cur) => cur.map((x) => x.id === s.id ? { ...x, enabled: v } : x)); update(s.id, { enabled: v }); }} />
                  Enabled
                </label>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Delete</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Cadence (minutes)</Label>
                <Input type="number" defaultValue={s.cadence_minutes} onBlur={(e) => update(s.id, { cadence_minutes: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label>Config (JSON)</Label>
                <Textarea rows={6} className="font-mono text-xs" defaultValue={JSON.stringify(s.config, null, 2)} onBlur={(e) => {
                  try { update(s.id, { config: JSON.parse(e.target.value) }); }
                  catch { toast.error("Invalid JSON"); }
                }} />
              </div>
              {s.last_error && <div className="md:col-span-2 text-xs text-destructive">{s.last_error}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
