import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Send, Clock, Loader2, CheckCircle2, AlertTriangle, AlertCircle, ExternalLink, Eye, Mail, MessageCircle, Award, ThumbsDown, FileEdit, Inbox, RotateCcw, Trash2, Skull } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { retryApplication, discardApplication } from "@/lib/applications.functions";
import { toast } from "sonner";
import { applicationsListQueryOptions, phaseOf, APPLICATIONS_QUERY_KEY, type ApplicationRow, type AppPhase } from "@/lib/queries/applications";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — JobPilot" }] }),
  component: ApplicationsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

const COLS: Array<{ phase: AppPhase; label: string; icon: LucideIcon; accent: string }> = [
  { phase: "discovered", label: "Discovered", icon: Inbox, accent: "text-muted-foreground" },
  { phase: "scored", label: "Scored", icon: Eye, accent: "text-muted-foreground" },
  { phase: "tailored", label: "Tailored", icon: FileEdit, accent: "text-primary/80" },
  { phase: "queued", label: "Queued", icon: Clock, accent: "text-primary" },
  { phase: "applying", label: "Applying", icon: Loader2, accent: "text-primary" },
  { phase: "submitted", label: "Submitted", icon: CheckCircle2, accent: "text-success" },
  { phase: "needs_review", label: "Needs review", icon: AlertTriangle, accent: "text-warning" },
  { phase: "failed", label: "Failed", icon: AlertCircle, accent: "text-destructive" },
  { phase: "dead_letter", label: "Dead letter", icon: Skull, accent: "text-destructive" },
  { phase: "follow_up_sent", label: "Followed up", icon: Mail, accent: "text-primary/80" },
  { phase: "replied", label: "Replied", icon: MessageCircle, accent: "text-success" },
  { phase: "interview", label: "Interview", icon: Award, accent: "text-gold" },
  { phase: "offer", label: "Offer", icon: Award, accent: "text-success" },
  { phase: "rejected", label: "Rejected", icon: ThumbsDown, accent: "text-destructive/80" },
];

function ApplicationsPage() {
  const qc = useQueryClient();
  const query = useQuery(applicationsListQueryOptions());
  const apps: ApplicationRow[] = query.data ?? [];
  const loading = query.isLoading;

  const invalidate = () => qc.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
  useRealtimeInvalidate({ table: "applications", onChange: invalidate });
  useRealtimeInvalidate({ table: "application_events", onChange: invalidate });

  const retryFn = useServerFn(retryApplication);
  const discardFn = useServerFn(discardApplication);
  const retryMut = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: () => { toast.success("Re-queued"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Retry failed"),
  });
  const discardMut = useMutation({
    mutationFn: (id: string) => discardFn({ data: { id } }),
    onSuccess: () => { toast.success("Discarded"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Discard failed"),
  });

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

  const byPhase = (p: AppPhase) => apps.filter((a) => phaseOf(a) === p);

  return (
    <div className="space-y-6 max-w-[1600px]">
      <PageHeader title="Applications" description={`${apps.length} total · 13-phase pipeline · live`} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-7">
        {COLS.map(({ phase, label, icon: Icon, accent }) => {
          const items = byPhase(phase);
          if (items.length === 0 && (phase === "follow_up_sent" || phase === "replied" || phase === "interview" || phase === "offer" || phase === "rejected" || phase === "tailored" || phase === "scored")) {
            return null;
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
                    {(a.last_error || a.dlq_reason) && (
                      <div className="mt-1.5 line-clamp-2 rounded border border-destructive/20 bg-destructive/5 p-1.5 text-[10px] text-destructive">
                        {a.dlq_reason || a.last_error}
                      </div>
                    )}
                    {(phase === "failed" || phase === "dead_letter" || phase === "needs_review") && (
                      <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); retryMut.mutate(a.id); }}
                          disabled={retryMut.isPending}
                          className="inline-flex items-center gap-1 rounded border border-border/60 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium hover:bg-surface-3 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" /> Retry
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("Discard this application?")) discardMut.mutate(a.id); }}
                          disabled={discardMut.isPending}
                          className="inline-flex items-center gap-1 rounded border border-border/60 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Discard
                        </button>
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
