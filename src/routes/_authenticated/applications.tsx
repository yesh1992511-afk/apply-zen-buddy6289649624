import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState, useCallback } from "react";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Send, Clock, Loader2, CheckCircle2, AlertTriangle, AlertCircle, ExternalLink, Eye, Mail, MessageCircle, Award, ThumbsDown, FileEdit, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — JobPilot" }] }),
  component: ApplicationsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type Phase =
  | "discovered" | "scored" | "tailored" | "queued" | "applying" | "submitted"
  | "needs_review" | "failed" | "follow_up_sent" | "replied" | "interview" | "offer" | "rejected";

type App = {
  id: string;
  status: string;
  phase: Phase;
  job_id: string;
  attempts: number;
  retry_count: number;
  last_error: string | null;
  queued_at: string;
  applied_at: string | null;
  job?: { title: string; company: string; url: string } | null;
};

const COLS: Array<{ phase: Phase; label: string; icon: LucideIcon; accent: string }> = [
  { phase: "discovered", label: "Discovered", icon: Inbox, accent: "text-muted-foreground" },
  { phase: "scored", label: "Scored", icon: Eye, accent: "text-muted-foreground" },
  { phase: "tailored", label: "Tailored", icon: FileEdit, accent: "text-primary/80" },
  { phase: "queued", label: "Queued", icon: Clock, accent: "text-primary" },
  { phase: "applying", label: "Applying", icon: Loader2, accent: "text-primary" },
  { phase: "submitted", label: "Submitted", icon: CheckCircle2, accent: "text-success" },
  { phase: "needs_review", label: "Needs review", icon: AlertTriangle, accent: "text-warning" },
  { phase: "failed", label: "Failed", icon: AlertCircle, accent: "text-destructive" },
  { phase: "follow_up_sent", label: "Followed up", icon: Mail, accent: "text-primary/80" },
  { phase: "replied", label: "Replied", icon: MessageCircle, accent: "text-success" },
  { phase: "interview", label: "Interview", icon: Award, accent: "text-gold" },
  { phase: "offer", label: "Offer", icon: Award, accent: "text-success" },
  { phase: "rejected", label: "Rejected", icon: ThumbsDown, accent: "text-destructive/80" },
];

function ApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    supabase
      .from("applications")
      .select("id, status, phase, job_id, attempts, retry_count, last_error, queued_at, applied_at, job:jobs(title, company, url)")
      .order("queued_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setApps((data ?? []) as unknown as App[]);
        setLoading(false);
      });
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeInvalidate({ table: "applications", onChange: load });
  useRealtimeInvalidate({ table: "application_events", onChange: load });

  // Back-compat: derive phase from legacy status when phase is missing/discovered
  const phaseOf = (a: App): Phase => {
    if (a.phase && a.phase !== "discovered") return a.phase;
    const map: Record<string, Phase> = {
      queued: "queued", applying: "applying", applied: "submitted",
      needs_review: "needs_review", failed: "failed",
    };
    return map[a.status] ?? "discovered";
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1600px]">
        <PageHeader title="Applications" description="Full pipeline view." />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {COLS.slice(0, 7).map((c) => (
            <div key={c.phase} className="h-64 animate-pulse rounded-xl border border-border/60 bg-surface-1" />
          ))}
        </div>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="space-y-6 max-w-[1600px]">
        <PageHeader title="Applications" description="Full pipeline view." />
        <EmptyState
          icon={Send}
          title="No applications yet"
          description="Queue jobs from the Jobs page or enable autopilot to populate this pipeline."
        />
      </div>
    );
  }

  const byPhase = (p: Phase) => apps.filter((a) => phaseOf(a) === p);

  return (
    <div className="space-y-6 max-w-[1600px]">
      <PageHeader title="Applications" description={`${apps.length} total · 13-phase pipeline · live`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-7">
        {COLS.map(({ phase, label, icon: Icon, accent }) => {
          const items = byPhase(phase);
          if (items.length === 0 && (phase === "follow_up_sent" || phase === "replied" || phase === "interview" || phase === "offer" || phase === "rejected" || phase === "tailored" || phase === "scored")) {
            return null; // hide empty advanced columns
          }
          return (
            <div key={phase} className="flex flex-col rounded-xl border border-border/60 bg-card">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", accent, phase === "applying" && "animate-spin")} />
                  <h3 className="truncate text-xs font-semibold">{label}</h3>
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-1.5 p-2 max-h-[600px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] italic text-muted-foreground/60">Empty</p>
                ) : items.map((a) => (
                  <Link
                    to="/applications/$id"
                    params={{ id: a.id }}
                    key={a.id}
                    className="block group rounded-lg border border-border/40 bg-surface-1 p-2.5 text-xs transition-all hover:border-primary/50 hover:bg-surface-2 hover:shadow-elegant"
                  >
                    <div className="line-clamp-2 font-medium leading-snug">{a.job?.title ?? "Job"}</div>
                    <div className="mt-0.5 truncate text-muted-foreground">{a.job?.company}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums">
                        {(a.retry_count > 0 || a.attempts > 0) && (
                          <span className="rounded bg-surface-3 px-1 py-0.5">×{Math.max(a.retry_count, a.attempts)}</span>
                        )}
                        <span>{new Date(a.queued_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                      </div>
                      {a.job?.url && (
                        <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(a.job!.url, "_blank"); }} className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground cursor-pointer">
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    {a.last_error && (
                      <div className="mt-1.5 line-clamp-2 rounded border border-destructive/20 bg-destructive/5 p-1.5 text-[10px] text-destructive">
                        {a.last_error}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
