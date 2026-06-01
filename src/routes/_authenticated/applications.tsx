import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AllApplicationsKanban } from "@/components/AllApplicationsKanban";
import { applicationsListQueryOptions, bucketOf, type AppBucket } from "@/lib/queries/applications";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — JobPilot" }] }),
  component: ApplicationsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

const TABS: Array<{ key: AppBucket; label: string }> = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "in_flight", label: "In flight" },
  { key: "needs_you", label: "Needs you" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

function ApplicationsPage() {
  const [tab, setTab] = useState<AppBucket>("all");
  const [search, setSearch] = useState("");
  const query = useQuery(applicationsListQueryOptions());
  const apps = query.data ?? [];

  const counts = useMemo(() => {
    const c: Record<AppBucket, number> = { all: apps.length, submitted: 0, in_flight: 0, needs_you: 0, failed: 0, skipped: 0 };
    for (const a of apps) { const b = bucketOf(a); if (b) c[b] += 1; }
    return c;
  }, [apps]);

  return (
    <div className="space-y-5 max-w-[1600px]">
      <PageHeader title="Applications" description="Full pipeline view · live" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
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
                <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-background/20" : "bg-surface-3 text-foreground/70")}>
                  {counts[t.key]}
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
      <AllApplicationsKanban fullHeight bucket={tab} search={search} />
    </div>
  );
}
