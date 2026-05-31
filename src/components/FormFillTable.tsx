import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { FileText } from "lucide-react";

export type FillSource = "profile" | "tailored" | "screening_cache" | "ai_generated";
export type FillRow = { id: number | string; field: string; value: string; ts: string; source?: FillSource };

const SOURCE_LABEL: Record<FillSource, { label: string; tone: string }> = {
  profile: { label: "Profile", tone: "bg-muted text-muted-foreground" },
  tailored: { label: "Tailored", tone: "bg-primary/15 text-primary" },
  screening_cache: { label: "Cached", tone: "bg-success/15 text-success" },
  ai_generated: { label: "AI", tone: "bg-accent/20 text-accent-foreground" },
};

export function FormFillTable({ rows, isActive }: { rows: FillRow[]; isActive: boolean }) {
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
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
        <h3 className="font-heading font-semibold text-sm">Application Questions</h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">{rows.length} filled</span>
      </div>
      <div className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          return (
            <div
              key={r.id}
              className={cn(
                "px-4 py-3 flex items-start gap-3 animate-fade-in transition-colors",
                last && isActive && "bg-primary/5 border-l-2 border-l-primary",
              )}
            >
              <div className="mt-0.5 shrink-0">
                {last && isActive
                  ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  : <Check className="h-3.5 w-3.5 text-success" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{r.field}</div>
                <div className="text-sm text-foreground break-words">{r.value || <span className="italic text-muted-foreground">(empty)</span>}</div>
              </div>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                {new Date(r.ts).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
