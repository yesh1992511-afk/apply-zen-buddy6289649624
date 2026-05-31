import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { FieldError } from "@/components/FieldError";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useAutosaveSection } from "@/hooks/useAutosaveSection";
import {
  automationQueryOptions,
  filtersListQueryOptions,
  useUpdateAutomation,
  type AutomationSettings,
} from "@/lib/queries/automation";
import {
  automationSchema,
  validateAutomationCross,
  type AutomationPatch,
} from "@/lib/validation/settings";
import type { z } from "zod";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Beaker, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerTestRun, waitForCommand } from "@/lib/commands";
import { toast } from "sonner";


type AutomationValues = z.infer<typeof automationSchema>;

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation — JobPilot" }] }),
  component: AutomationPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

const SECRET_GROUPS = {
  decodo: { label: "Decodo residential proxy", names: ["DECODO_USERNAME", "DECODO_PASSWORD", "DECODO_HOST"] as const, hint: "Sticky session per portal, rotating exit IPs." },
  capsolver: { label: "CapSolver", names: ["CAPSOLVER_API_KEY"] as const, hint: "Solves reCAPTCHA, hCaptcha, image puzzles during apply." },
  openai: { label: "OpenAI", names: ["OPENAI_API_KEY", "OPENAI_MODEL"] as const, hint: "Used for resume tailoring + cover-letter generation." },
  deepseek: { label: "DeepSeek (reasoner)", names: ["DEEPSEEK_API_KEY", "DEEPSEEK_REASONER_MODEL", "DEEPSEEK_CHAT_MODEL"] as const, hint: "Cheap reasoning model for JD analysis." },
  gmail: { label: "Gmail OAuth (OTP)", names: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "GMAIL_OAUTH_REFRESH_TOKEN", "GMAIL_EMAIL"] as const, hint: "Reads OTP / email-verification codes during apply." },
  apply: { label: "Apply identity", names: ["APPLY_EMAIL", "APPLY_PASSWORD", "APPLY_DEFAULT_PHONE"] as const, hint: "Default credentials worker uses to log in to portals." },
} as const;

type SecretGroupKey = keyof typeof SECRET_GROUPS;

function SecretStatusPanel({ group }: { group: SecretGroupKey }) {
  const cfg = SECRET_GROUPS[group];
  const names = cfg.names as readonly string[];
  const q = useQuery({
    queryKey: ["secrets_meta", group],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secrets_meta")
        .select("name,status")
        .in("name", names as unknown as string[]);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ name: string; status: string }>;
    },
    staleTime: 30_000,
  });
  const setNames = new Set((q.data ?? []).filter((r) => r.status === "set").map((r) => r.name));
  const missing = names.filter((n) => !setNames.has(n));
  const allSet = missing.length === 0;
  return (
    <div className="rounded-md border border-border/60 bg-surface-1/40 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={allSet ? "secondary" : "outline"} className={allSet ? "bg-emerald-500/15 text-emerald-300 shrink-0" : "text-amber-300 shrink-0"}>
            {allSet ? "Configured" : "Not configured"}
          </Badge>
          <span className="font-medium truncate">{cfg.label}</span>
        </div>
      </div>
      <p className="mt-1 text-muted-foreground">{cfg.hint}</p>
      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {names.map((n) => {
          const ok = setNames.has(n);
          return (
            <li key={n} className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
              <code className="text-[11px]">{n}</code>
            </li>
          );
        })}
      </ul>
      {!allSet && (
        <p className="mt-2 text-muted-foreground">
          Add the missing secret{missing.length === 1 ? "" : "s"} in Lovable Cloud → Secrets. The worker reads them at runtime.
        </p>
      )}
    </div>
  );
}

function DecodoStatus() {
  return <SecretStatusPanel group="decodo" />;
}

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
  } = useAutosaveSection<AutomationValues>({
    schema: automationSchema,
    initial: settings.data ? (pickAutomationFields(settings.data) as AutomationValues) : null,
    onSave: async (patch) => {
      const crossErr = validateAutomationCross({ ...(s ?? {}), ...patch } as AutomationPatch);
      if (crossErr) throw new Error(crossErr);
      await mutation.mutateAsync(patch as AutomationPatch);
    },
  });

  if (settings.isError) {
    return <QueryErrorState error={settings.error as Error} onRetry={() => settings.refetch()} />;
  }
  if (!s) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className="shimmer h-9 w-64 rounded-md" />
        <div className="shimmer h-32 rounded-xl" />
        <div className="shimmer h-32 rounded-xl" />
        <div className="shimmer h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Automation"
        description="Master controls for the autopilot worker. Changes save automatically."
      />

      <TestModeCard />

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
        <Row label="24/7 mode" desc="If off, the worker only runs inside the daily window.">
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
            <Badge variant="secondary" className="tabular-nums">
              {s.max_applies_per_day}
            </Badge>
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
            <Badge variant="secondary" className="tabular-nums">
              {s.parallelism}
            </Badge>
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
            <Badge variant="secondary" className="tabular-nums">
              {s.aggressiveness}/5
            </Badge>
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
              set("active_filter_id", (v || null) as AutomationValues["active_filter_id"]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {(filters.data ?? []).map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Globally excluded companies</Label>
          <Input
            defaultValue={(s.exclude_companies ?? []).join(", ")}
            onBlur={(e) => {
              const list = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              value={s.proxy_provider ?? "decodo"}
              onValueChange={(v) => set("proxy_provider", v as AutomationValues["proxy_provider"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Decodo (recommended)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decodo">Decodo (recommended)</SelectItem>
                <SelectItem value="iproyal">IPRoyal</SelectItem>
                <SelectItem value="brightdata">BrightData</SelectItem>
                <SelectItem value="smartproxy">Smartproxy</SelectItem>
                <SelectItem value="oxylabs">Oxylabs</SelectItem>
              </SelectContent>
            </Select>
            {(s.proxy_provider ?? "decodo") === "decodo" && <DecodoStatus />}
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

function pickAutomationFields(s: AutomationSettings): AutomationValues {
  const { user_id: _u, ...rest } = s;
  return rest as unknown as AutomationValues;
}

function TestModeCard() {
  const [limit, setLimit] = useState(2);
  const [sourceKey, setSourceKey] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ["sources", "enabled-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sources")
        .select("key, display_name, enabled")
        .eq("enabled", true)
        .order("display_name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ key: string; display_name: string; enabled: boolean }>;
    },
    staleTime: 30_000,
  });

  const effectiveKey = sourceKey || sources.data?.[0]?.key || "";

  async function handleRun() {
    if (!effectiveKey) {
      toast.error("Enable at least one source on the Sources page first.");
      return;
    }
    setRunning(true);
    setLastResult(null);
    try {
      const id = await triggerTestRun(effectiveKey, limit);
      if (!id) return;
      const row = await waitForCommand(id, 5 * 60_000);
      if (row?.status === "done") {
        const r = (row.result ?? {}) as { matched?: number; applied?: number };
        const msg = `Done — matched ${r.matched ?? 0}, applied ${r.applied ?? 0}`;
        setLastResult(msg);
        toast.success(msg);
      } else if (row?.status === "failed") {
        const msg = `Failed: ${row.last_error ?? "unknown error"}`;
        setLastResult(msg);
        toast.error(msg);
      } else {
        setLastResult("Still running — check Worker page for progress.");
        toast.message("Worker still busy. Check Worker page.");
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <SectionCard
      title="Test mode"
      description="Scrape one source until N matched jobs, then auto-apply them. Bypasses daily caps."
    >
      <div>
        <Label>Source</Label>
        <Select value={effectiveKey} onValueChange={setSourceKey}>
          <SelectTrigger>
            <SelectValue placeholder={sources.isLoading ? "Loading…" : "No enabled sources"} />
          </SelectTrigger>
          <SelectContent>
            {(sources.data ?? []).map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.display_name} ({s.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="flex items-center justify-between">
          <span>Stop after N matched jobs</span>
          <Badge variant="secondary" className="tabular-nums">{limit}</Badge>
        </Label>
        <Slider
          value={[limit]}
          min={1}
          max={10}
          step={1}
          onValueChange={(v) => setLimit(v[0])}
          className="mt-2"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleRun} disabled={running || !effectiveKey}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Beaker className="mr-2 h-4 w-4" />}
          {running ? "Running test…" : "Run test"}
        </Button>
        {lastResult && <span className="text-xs text-muted-foreground">{lastResult}</span>}
      </div>
    </SectionCard>
  );
}

