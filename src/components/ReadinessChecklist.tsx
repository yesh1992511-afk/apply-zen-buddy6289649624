import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, AlertCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getSystemReadiness, type ReadinessCheck } from "@/lib/readiness.functions";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/skeletons";

const ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fail: AlertCircle,
} as const;

const TONE = {
  ok: "text-success bg-success/10 border-success/30",
  warn: "text-warning bg-warning/10 border-warning/30",
  fail: "text-destructive bg-destructive/10 border-destructive/30",
} as const;

export function useReadiness() {
  const fetcher = useServerFn(getSystemReadiness);
  return useQuery({
    queryKey: ["system-readiness"],
    queryFn: () => fetcher(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function ReadinessChecklist({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useReadiness();
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="space-y-2">
      {data.checks.map((c) => (
        <CheckRow key={c.key} c={c} compact={compact} />
      ))}
    </div>
  );
}

function CheckRow({ c, compact }: { c: ReadinessCheck; compact: boolean }) {
  const Icon = ICON[c.status];
  return (
    <Link
      to={c.href}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all hover:shadow-elegant",
        TONE[c.status],
        compact && "py-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{c.label}</div>
        {!compact && <div className="mt-0.5 text-xs opacity-80 truncate">{c.detail}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
    </Link>
  );
}

/** Slim banner for dashboard — only shows when there are failures. */
export function ReadinessBanner() {
  const { data } = useReadiness();
  if (!data || data.failCount === 0) return null;
  const firstFail = data.checks.find((c) => c.status === "fail");
  if (!firstFail) return null;
  return (
    <Link
      to="/setup"
      className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 transition-all hover:bg-destructive/15"
    >
      <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-destructive-foreground">
          Autopilot is blocked — {data.failCount} setup step{data.failCount === 1 ? "" : "s"} need attention
        </div>
        <div className="mt-0.5 text-xs text-destructive-foreground/80 truncate">
          {firstFail.label}: {firstFail.detail}
        </div>
      </div>
      <span className="text-xs font-medium text-destructive-foreground/80">Fix in Setup</span>
      <ChevronRight className="h-4 w-4 text-destructive shrink-0" />
    </Link>
  );
}
