import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, CheckCheck, AlertCircle, Inbox, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { EmptyState } from "@/components/EmptyState";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { AllApplicationsKanban } from "@/components/AllApplicationsKanban";
import {
  applicationsListQueryOptions,
  bucketOf,
  phaseOf,
  APPLICATIONS_QUERY_KEY,
  type ApplicationRow,
  type AppBucket,
} from "@/lib/queries/applications";

type TabDef = { key: AppBucket; label: string };

const TABS: TabDef[] = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "in_flight", label: "In flight" },
  { key: "needs_you", label: "Needs you" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

function statusChip(a: ApplicationRow): { label: string; cls: string; dot: string } {
  const p = phaseOf(a);
  if (p === "submitted" || p === "follow_up_sent" || p === "replied") {
    return { label: "Submitted", cls: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30", dot: "bg-emerald-400" };
  }
  if (p === "interview" || p === "offer") {
    return { label: p === "offer" ? "Offer" : "Interview", cls: "bg-gold/10 text-gold ring-1 ring-gold/30", dot: "bg-gold" };
  }
  if (p === "queued" || p === "applying" || p === "tailored" || p === "scored") {
    return { label: p === "applying" ? "Applying…" : "In flight", cls: "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/30", dot: "bg-amber-400" };
  }
  if (p === "needs_review") {
    return { label: "Needs you", cls: "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/30", dot: "bg-rose-400" };
  }
  if (p === "failed" || p === "dead_letter") {
    return { label: "Application Failed", cls: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-400/30", dot: "bg-rose-400" };
  }
  if (a.status === "skipped") {
    return { label: "Skipped", cls: "bg-muted/40 text-muted-foreground ring-1 ring-border/60", dot: "bg-muted-foreground" };
  }
  return { label: "Discovered", cls: "bg-muted/40 text-muted-foreground ring-1 ring-border/60", dot: "bg-muted-foreground" };
}

function readyDash(present: boolean) {
  return present ? (
    <span className="inline-flex items-center gap-1.5 text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <span className="text-xs">Ready</span>
    </span>
  ) : (
    <span className="text-muted-foreground/60">—</span>
  );
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-foreground/80 ring-1 ring-border/60">
      {initials || "?"}
    </div>
  );
}

export function AllApplicationsTable() {
  const qc = useQueryClient();
  const query = useQuery(applicationsListQueryOptions());
  const apps: ApplicationRow[] = query.data ?? [];
  const [tab, setTab] = useState<AppBucket>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "kanban">("table");

  useRealtimeInvalidate({
    table: "applications",
    onChange: () => qc.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY }),
  });

  const counts = useMemo(() => {
    const c: Record<AppBucket, number> = {
      all: apps.length,
      submitted: 0, in_flight: 0, needs_you: 0, failed: 0, skipped: 0,
    };
    for (const a of apps) {
      const b = bucketOf(a);
      if (b) c[b] += 1;
    }
    return c;
  }, [apps]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (tab !== "all" && bucketOf(a) !== tab) return false;
      if (!s) return true;
      return (a.job?.company ?? "").toLowerCase().includes(s) || (a.job?.title ?? "").toLowerCase().includes(s);
    });
  }, [apps, tab, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">All applications</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/60 bg-surface-2 p-0.5">
            <button
              onClick={() => setView("table")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === "table" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TableIcon className="h-3.5 w-3.5" /> Table
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === "kanban" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>
          <Button variant="outline" size="sm" disabled className="gap-1.5">
            <CheckCheck className="h-4 w-4" />
            Approve all
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  active
                    ? "border-foreground/80 bg-foreground text-background"
                    : "border-border/60 bg-surface-2 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    active ? "bg-background/20" : "bg-surface-3 text-foreground/70",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-2 border-border/60 h-9"
          />
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 shimmer rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === "failed" ? AlertCircle : Inbox}
          title="No applications here"
          description={tab === "all" ? "Queue jobs to start populating this list." : "Nothing matches this filter."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="hidden md:grid grid-cols-[1.7fr_0.7fr_0.7fr_0.9fr_0.7fr] gap-4 border-b border-border/40 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Company</span>
            <span>Resume</span>
            <span>Cover letter</span>
            <span>Status</span>
            <span>Applied</span>
          </div>
          <ul className="divide-y divide-border/40">
            {filtered.map((a) => {
              const chip = statusChip(a);
              const company = a.job?.company ?? "—";
              const title = a.job?.title ?? "Application";
              const appliedTs = a.applied_at ?? a.queued_at;
              return (
                <li key={a.id}>
                  <Link
                    to="/applications/$id"
                    params={{ id: a.id }}
                    className="grid grid-cols-[1.7fr_0.7fr_0.7fr_0.9fr_0.7fr] gap-4 px-4 py-3 items-center text-sm transition-colors hover:bg-surface-2/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CompanyAvatar name={company} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{company}</div>
                        <div className="text-xs text-muted-foreground truncate">{title}</div>
                      </div>
                    </div>
                    <div>{readyDash(!!(a.resume_id || a.generated_resume_id))}</div>
                    <div>{readyDash(!!a.cover_letter_id)}</div>
                    <div>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium", chip.cls)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
                        {chip.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">{timeAgo(appliedTs)}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
