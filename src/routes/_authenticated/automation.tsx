import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation — JobPilot" }] }),
  component: AutomationPage,
});

type Settings = {
  user_id: string;
  enabled: boolean;
  run_24_7: boolean;
  daily_start: string | null;
  daily_end: string | null;
  timezone: string | null;
  max_applies_per_day: number;
  parallelism: number;
  aggressiveness: number;
  exclude_companies: string[];
  captcha_provider: string | null;
  proxy_provider: string | null;
  ai_resume_model: string | null;
  ai_reasoning_model: string | null;
  active_filter_id: string | null;
};

function AutomationPage() {
  const { user } = useUser();
  const [s, setS] = useState<Settings | null>(null);
  const [filters, setFilters] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("automation_settings").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setS(data as Settings));
    supabase.from("filters").select("id, name").then(({ data }) => setFilters(data ?? []));
  }, [user]);

  const save = async () => {
    if (!s || !user) return;
    setSaving(true);
    const { error } = await supabase.from("automation_settings").update({
      ...s,
      exclude_companies: s.exclude_companies ?? [],
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  if (!s) return <div className="text-muted-foreground">Loading…</div>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground">Master controls for the worker.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Master switch</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <div className="font-medium">Worker enabled</div>
              <div className="text-xs text-muted-foreground">Master kill switch. When off, the worker stops scraping & applying.</div>
            </div>
            <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <div className="font-medium">24/7 mode</div>
              <div className="text-xs text-muted-foreground">If off, the worker only runs inside the daily window.</div>
            </div>
            <Switch checked={s.run_24_7} onCheckedChange={(v) => set("run_24_7", v)} />
          </label>
          {!s.run_24_7 && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Daily start</Label><Input type="time" value={s.daily_start ?? "08:00"} onChange={(e) => set("daily_start", e.target.value)} /></div>
              <div><Label>Daily end</Label><Input type="time" value={s.daily_end ?? "22:00"} onChange={(e) => set("daily_end", e.target.value)} /></div>
            </div>
          )}
          <div><Label>Timezone</Label><Input value={s.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} placeholder="UTC, America/New_York, etc." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Apply behavior</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Max applies per day: <span className="text-primary">{s.max_applies_per_day}</span></Label>
            <Slider value={[s.max_applies_per_day]} min={1} max={200} step={1} onValueChange={(v) => set("max_applies_per_day", v[0])} />
          </div>
          <div>
            <Label>Parallelism (concurrent browsers): <span className="text-primary">{s.parallelism}</span></Label>
            <Slider value={[s.parallelism]} min={1} max={8} step={1} onValueChange={(v) => set("parallelism", v[0])} />
          </div>
          <div>
            <Label>Aggressiveness: <span className="text-primary">{s.aggressiveness}/5</span></Label>
            <CardDescription className="mb-2">1 = slow, human-like, Easy Apply only · 5 = max throughput, all portals, parallel</CardDescription>
            <Slider value={[s.aggressiveness]} min={1} max={5} step={1} onValueChange={(v) => set("aggressiveness", v[0])} />
          </div>
          <div>
            <Label>Active filter (jobs that match this filter are auto-eligible)</Label>
            <Select value={s.active_filter_id ?? ""} onValueChange={(v) => set("active_filter_id", v || null)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {filters.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Globally excluded companies (comma-separated)</Label>
            <Input defaultValue={(s.exclude_companies ?? []).join(", ")} onBlur={(e) => set("exclude_companies", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Anti-detection & AI providers</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Captcha provider</Label>
            <Select value={s.captcha_provider ?? ""} onValueChange={(v) => set("captcha_provider", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2captcha">2Captcha</SelectItem>
                <SelectItem value="capsolver">CapSolver</SelectItem>
                <SelectItem value="anticaptcha">Anti-Captcha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Proxy provider</Label>
            <Select value={s.proxy_provider ?? ""} onValueChange={(v) => set("proxy_provider", v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iproyal">IPRoyal</SelectItem>
                <SelectItem value="brightdata">BrightData</SelectItem>
                <SelectItem value="smartproxy">Smartproxy</SelectItem>
                <SelectItem value="oxylabs">Oxylabs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>AI resume model (OpenAI)</Label>
            <Input value={s.ai_resume_model ?? ""} onChange={(e) => set("ai_resume_model", e.target.value)} placeholder="openai/gpt-5" />
          </div>
          <div>
            <Label>AI reasoning model (DeepSeek)</Label>
            <Input value={s.ai_reasoning_model ?? ""} onChange={(e) => set("ai_reasoning_model", e.target.value)} placeholder="deepseek/deepseek-reasoner" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
