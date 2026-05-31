import { useMemo, useState } from "react";
import { Check, Loader2, Copy, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

export type FillSource = "profile" | "tailored" | "screening_cache" | "ai_generated";
export type FillRow = {
  id: number | string;
  field: string;
  value: string;
  ts: string;
  source?: FillSource;
  needs_review?: boolean;
};

const SOURCE_LABEL: Record<FillSource, { label: string; tone: string }> = {
  profile: { label: "Profile", tone: "bg-muted text-muted-foreground" },
  tailored: { label: "Tailored", tone: "bg-primary/15 text-primary" },
  screening_cache: { label: "Cached", tone: "bg-success/15 text-success" },
  ai_generated: { label: "AI", tone: "bg-accent/20 text-accent-foreground" },
};

const FILTERS: Array<{ key: "all" | FillSource; label: string }> = [
  { key: "all", label: "All" },
  { key: "profile", label: "Profile" },
  { key: "tailored", label: "Tailored" },
  { key: "screening_cache", label: "Cached" },
  { key: "ai_generated", label: "AI" },
];

export function FormFillTable({ rows, isActive }: { rows: FillRow[]; isActive: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.source === filter)),
    [rows, filter],
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No form fields filled yet"
        description={isActive
          ? "The worker will start filling fields here as soon as it lands on the application page."
          : "Once the autopilot picks this application up, every filled field will show up here in real time."}
      />
    );
  }

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
    toast.success("Copied ledger as JSON");
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-heading font-semibold text-sm">Application questions</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => {
              const count = f.key === "all" ? rows.length : rows.filter((r) => r.source === f.key).length;
              if (f.key !== "all" && count === 0) return null;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide transition-colors",
                    filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground",
                  )}
                >
                  {f.label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={copyJson}
            className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/70 text-muted-foreground inline-flex items-center gap-1"
            title="Copy ledger as JSON"
          >
            <Copy className="h-3 w-3" /> JSON
          </button>
        </div>
      </div>
      <div className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
        {filtered.map((r, i) => {
          const last = i === filtered.length - 1;
          return (
            <div
              key={r.id}
              className={cn(
                "px-4 py-3 flex items-start gap-3 animate-fade-in transition-colors",
                last && isActive && filter === "all" && "bg-primary/5 border-l-2 border-l-primary",
                r.needs_review && "bg-amber-500/5",
              )}
            >
              <div className="mt-0.5 shrink-0">
                {r.needs_review
                  ? <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  : last && isActive && filter === "all"
                    ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                    : <Check className="h-3.5 w-3.5 text-success" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{r.field}</div>
                  {r.source && (
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide", SOURCE_LABEL[r.source].tone)}>
                      {SOURCE_LABEL[r.source].label}
                    </span>
                  )}
                  {r.needs_review && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      Review
                    </span>
                  )}
                </div>
                <div className="text-sm text-foreground break-words">{r.value || <span className="italic text-muted-foreground">(empty)</span>}</div>
              </div>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                {r.ts ? new Date(r.ts).toLocaleTimeString([], { hour12: false }) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
