import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle, Circle } from "lucide-react";

export type SourceHealthInput = {
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
  cadence_minutes: number;
};

export type HealthLevel = "ok" | "stale" | "error" | "idle";

export function computeSourceHealth(s: SourceHealthInput): HealthLevel {
  if (s.last_error || s.last_run_status === "error") return "error";
  if (!s.enabled || !s.last_run_at) return "idle";
  const ageMs = Date.now() - new Date(s.last_run_at).getTime();
  const limitMs = Math.max(s.cadence_minutes, 1) * 60_000 * 2;
  if (s.last_run_status === "ok" && ageMs <= limitMs) return "ok";
  return "stale";
}

const STYLES: Record<HealthLevel, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok:    { label: "Healthy", cls: "bg-success/15 text-success ring-1 ring-success/30",            Icon: CheckCircle2 },
  stale: { label: "Stale",   cls: "bg-warning/15 text-warning ring-1 ring-warning/30",            Icon: Clock },
  error: { label: "Error",   cls: "bg-destructive/15 text-destructive ring-1 ring-destructive/30", Icon: AlertCircle },
  idle:  { label: "Idle",    cls: "bg-surface-2 text-muted-foreground ring-1 ring-border/40",     Icon: Circle },
};

export function SourceHealthBadge({ level, className }: { level: HealthLevel; className?: string }) {
  const { label, cls, Icon } = STYLES[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        cls,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
