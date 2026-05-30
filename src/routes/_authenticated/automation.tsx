import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { FieldError } from "@/components/FieldError";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useAutosaveSection } from "@/hooks/useAutosaveSection";
import { automationQueryOptions, filtersListQueryOptions, useUpdateAutomation, type AutomationSettings } from "@/lib/queries/automation";
import { automationSchema, validateAutomationCross, type AutomationPatch } from "@/lib/validation/settings";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation — JobPilot" }] }),
  component: AutomationPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

function AutomationPage() {
  const settings = useQuery(automationQueryOptions());
  const filters = useQuery(filtersListQueryOptions());
  const mutation = useUpdateAutomation();

  useRealtimeInvalidate({ table: "automation_settings", queryKey: ["automation_settings"] });

  const {
    values: s,
    set,
    flush,
    saveState,
    error,
    errors,
  } = useAutosaveSection({
    schema: automationSchema,
    initial: settings.data
      ? (pickAutomationFields(settings.data) as AutomationPatch)
      : null,
    onSave: async (patch) => {
      const crossErr = validateAutomationCross({ ...(s ?? {}), ...patch });
      if (crossErr) throw new Error(crossErr);
      await mutation.mutateAsync(patch);
    },
  });

  if (settings.isError) {
    return <QueryErrorState error={settings.error as Error} onRetry={() => settings.refetch()} />;
  }
  if (!s) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Automation"
        description="Master controls for the autopilot worker. Changes save automatically."
      />

      <SectionCard
        title="Master switch"
        description="Stop or start the whole worker, and define when it can run."
        saveState={saveState}
        error={error}
      >
        <Row
          label="Worker enabled"
          desc="Master kill switch. When off, the worker stops scraping & applying."
        >
          <Switch checked={!!s.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </Row>
        <Row
          label="24/7 mode"
          desc="If off, the worker only runs inside the daily window."
        >
          <Switch checked={!!s.run_24_7} onCheckedChange={(v) => set("run_24_7", v)} />
        </Row>
        {!s.run_24_7 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Daily start</Label>
              <Input
                type="time"
                value={(s.daily_start ?? "08:00").slice(0, 5)}
                onChange={(e) => set("daily_start", e.target.value)}
                onBlur={flush}
              />
              <FieldError message={errors.daily_start} />
            </div>
            <div>
              <Label>Daily end</Label>
              <Input
                type="time"
                value={(s.daily_end ?? "22:00").slice(0, 5)}
                onChange={(e) => set("daily_end", e.target.value)}
                onBlur={flush}
              />
              <FieldError message={errors.daily_end} />
            </div>
          </div>
        )}
        <div>
          <Label>Timezone</Label>
          <Input
            value={s.timezone ?? ""}
            onChange={(e) => set("timezone", e.target.value)}
            onBlur={flush}
            placeholder="UTC, America/New_York, etc."
          />
          <FieldError message={errors.timezone} />
        </div>
      </SectionCard>

      <SectionCard
        title="Throughput"
        description="How aggressively the worker applies."
        saveState={saveState}
        error={error}
      >
        <div>
          <Label className="flex items-center justify-between">
            <span>Max applies per day</span>
            <Badge variant="secondary" className="tabular-nums">{s.max_applies_per_day}</Badge>
          </Label>
          <Slider
            value={[s.max_applies_per_day ?? 50]}
            min={1}
            max={500}
            step={1}
            onValueChange={(v) => set("max_applies_per_day", v[0])}
            onValueCommit={flush}
            className="mt-2"
          />
          <FieldError message={errors.max_applies_per_day} />
        </div>
        <div>
          <Label className="flex items-center justify-between">
            <span>Parallelism (concurrent browsers)</span>
            <Badge variant="secondary" className="tabular-nums">{s.parallelism}</Badge>
          </Label>
          <Slider
            value={[s.parallelism ?? 2]}
            min={1}
            max={10}
            step={1}
            onValueChange={(v) => set("parallelism", v[0])}
            onValueCommit={flush}
            className="mt-2"
          />
          <FieldError message={errors.parallelism} />
        </div>
        <div>
          <Label className="flex items-center justify-between">
            <span>Aggressiveness</span>
            <Badge variant="secondary" className="tabular-nums">{s.aggressiveness}/5</Badge>
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            1 = slow, human-like, Easy Apply only · 5 = max throughput, all portals, parallel.
          </p>
          <Slider
            value={[s.aggressiveness ?? 3]}
            min={1}
            max={5}
            step={1}
            onValueChange={(v) => set("aggressiveness", v[0])}
            onValueCommit={flush}
            className="mt-2"
          />
          <FieldError message={errors.aggressiveness} />
        </div>
      </SectionCard>

      <SectionCard
        title="Targeting"
        description="Which jobs the worker is allowed to consider."
        saveState={saveState}
        error={error}
      >
        <div>
          <Label>Active filter</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Jobs matching this filter are auto-eligible for the worker.
          </p>
          <Select
            value={s.active_filter_id ?? ""}
            onValueChange={(v) => {
              set("active_filter_id", (v || null) as AutomationPatch["active_filter_id"]);
            }}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              {(filters.data ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Globally excluded companies</Label>
          <Input
            defaultValue={(s.exclude_companies ?? []).join(", ")}
            onBlur={(e) => {
              const list = e.target.value.split(",").map((x) => x.trim()).filter(Boolean);
              set("exclude_companies", list);
              flush();
            }}
            placeholder="comma-separated"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Companies listed here are skipped even if they match a filter.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Anti-detection & AI providers"
        description="Which providers the worker calls under the hood."
        saveState={saveState}
        error={error}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Captcha provider</Label>
            <Select
              value={s.captcha_provider ?? ""}
              onValueChange={(v) => set("captcha_provider", v)}
            >
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
            <Select
              value={s.proxy_provider ?? ""}
              onValueChange={(v) => set("proxy_provider", v)}
            >
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
            <Label>AI resume model</Label>
            <Input
              value={s.ai_resume_model ?? ""}
              onChange={(e) => set("ai_resume_model", e.target.value)}
              onBlur={flush}
              placeholder="openai/gpt-5"
            />
          </div>
          <div>
            <Label>AI reasoning model</Label>
            <Input
              value={s.ai_reasoning_model ?? ""}
              onChange={(e) => set("ai_reasoning_model", e.target.value)}
              onBlur={flush}
              placeholder="deepseek/deepseek-reasoner"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-1/40 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      {children}
    </label>
  );
}

function pickAutomationFields(s: AutomationSettings): AutomationPatch {
  // Drop columns we don't validate / persist via this form.
  const { user_id: _u, ...rest } = s;
  return rest as AutomationPatch;
}
