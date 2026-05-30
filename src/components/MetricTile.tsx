import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "default",
  className,
  children,
}: {
  label: string;
  value?: number | string | null;
  hint?: string;
  icon?: LucideIcon;
  accent?: "default" | "gold" | "success" | "danger";
  className?: string;
  children?: React.ReactNode;
}) {
  const accentRing =
    accent === "gold"
      ? "before:bg-gradient-gold"
      : accent === "success"
        ? "before:bg-success"
        : accent === "danger"
          ? "before:bg-destructive"
          : "before:bg-primary/60";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 transition-all",
        "hover:border-border hover:shadow-elegant",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:opacity-70",
        accentRing,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />}
      </div>
      <div className="mt-3 font-heading text-3xl font-semibold tabular-nums tracking-tight">
        {value ?? "—"}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
