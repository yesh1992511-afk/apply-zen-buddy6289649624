import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Send, Clock, Loader2, CheckCircle2, AlertTriangle, AlertCircle, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — JobPilot" }] }),
  component: ApplicationsPage,
});

type App = {
  id: string;
  status: string;
  job_id: string;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  applied_at: string | null;
  job?: { title: string; company: string; url: string } | null;
};

const COLS: Array<{ status: string; label: string; icon: LucideIcon; accent: string }> = [
  { status: "queued", label: "Queued", icon: Clock, accent: "text-muted-foreground" },
  { status: "applying", label: "Applying", icon: Loader2, accent: "text-primary" },
  { status: "applied", label: "Applied", icon: CheckCircle2, accent: "text-success" },
  { status: "needs_review", label: "Needs review", icon: AlertTriangle, accent: "text-warning" },
  { status: "failed", label: "Failed", icon: AlertCircle, accent: "text-destructive" },
];

function ApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("applications")
      .select("id, status, job_id, attempts, last_error, queued_at, applied_at, job:jobs(title, company, url)")
      .order("queued_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setApps((data ?? []) as unknown as App[]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader title="Applications" description="Pipeline view of every application." />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {COLS.map((c) => (
            <div key={c.status} className="h-64 animate-pulse rounded-xl border border-border/60 bg-surface-1" />
          ))}
        </div>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader title="Applications" description="Pipeline view of every application." />
        <EmptyState
          icon={Send}
          title="No applications yet"
          description="Once you queue jobs from the Jobs page (or autopilot picks them up), they'll move through this pipeline."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader title="Applications" description={`${apps.length} total · live pipeline view`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {COLS.map(({ status, label, icon: Icon, accent }) => {
          const items = apps.filter((a) => a.status === status);
          return (
            <div key={status} className="flex flex-col rounded-xl border border-border/60 bg-card">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5", accent, status === "applying" && "animate-spin")} />
                  <h3 className="text-sm font-semibold">{label}</h3>
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-1.5 p-2 max-h-[600px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] italic text-muted-foreground/60">Empty</p>
                ) : (
                  items.map((a) => (
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
                          {a.attempts > 0 && <span className="rounded bg-surface-3 px-1 py-0.5">×{a.attempts}</span>}
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
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
