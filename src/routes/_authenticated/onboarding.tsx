import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Check, Chrome, Mail, Server, Filter, Database, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — JobPilot" }] }),
  component: OnboardingPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type StepStatus = { profile: boolean; extension: boolean; gmail: boolean; worker: boolean; filter: boolean; source: boolean; firstApply: boolean };

function OnboardingPage() {
  const [status, setStatus] = useState<StepStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: p }, { data: ext }, { data: gmail }, { data: hb }, { data: filters }, { data: sources }, { data: apps }] = await Promise.all([
        supabase.from("profile").select("full_name, location, work_authorization").maybeSingle(),
        supabase.from("extension_tokens").select("last_seen_at").not("last_seen_at", "is", null).limit(1),
        supabase.from("gmail_credentials").select("verified_at").not("verified_at", "is", null).limit(1),
        supabase.from("worker_heartbeat").select("last_seen").maybeSingle(),
        supabase.from("filters").select("id").limit(1),
        supabase.from("sources").select("id").eq("enabled", true).limit(1),
        supabase.from("applications").select("id").limit(1),
      ]);
      setStatus({
        profile: Boolean(p?.full_name && p?.location && p?.work_authorization),
        extension: (ext ?? []).length > 0,
        gmail: (gmail ?? []).length > 0,
        worker: Boolean(hb?.last_seen && Date.now() - new Date(hb.last_seen).getTime() < 24 * 3600_000),
        filter: (filters ?? []).length > 0,
        source: (sources ?? []).length > 0,
        firstApply: (apps ?? []).length > 0,
      });
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!status) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const steps = [
    { key: "profile", label: "Complete your profile", desc: "Name, location, work authorization", to: "/profile", icon: User, done: status.profile },
    { key: "extension", label: "Install the browser extension", desc: "Capture jobs from any page", to: "/extension", icon: Chrome, done: status.extension },
    { key: "worker", label: "Bring the worker online", desc: "Local or VPS install", to: "/setup", icon: Server, done: status.worker },
    { key: "gmail", label: "Connect Gmail", desc: "For sending applications & follow-ups", to: "/profile", icon: Mail, done: status.gmail },
    { key: "filter", label: "Create a job filter", desc: "Tell JobPilot what you want", to: "/filters", icon: Filter, done: status.filter },
    { key: "source", label: "Enable a job source", desc: "LinkedIn, Indeed, Wellfound, etc.", to: "/sources", icon: Database, done: status.source },
    { key: "firstApply", label: "Queue your first apply", desc: "From the Jobs page", to: "/jobs", icon: Send, done: status.firstApply },
  ];

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="space-y-6 max-w-[1000px]">
      <PageHeader title="Welcome to JobPilot" description="Get the cockpit ready in 7 steps." />

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-heading text-base font-semibold">Setup progress</h3>
          <div className="tabular-nums text-sm font-medium">{done} / {steps.length}</div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-gradient-emerald transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => (
          <Link
            key={s.key}
            to={s.to}
            className={cn(
              "flex items-center gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/40",
              s.done ? "border-success/30 bg-success/5" : "border-border/60",
            )}
          >
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", s.done ? "bg-success/20 text-success" : "bg-surface-2 text-muted-foreground")}>
              {s.done ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold tabular-nums">{i + 1}</span>}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium text-sm">{s.label}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
            </div>
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", s.done ? "text-success" : "text-muted-foreground")}>
              {s.done ? "Done" : "Open →"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
