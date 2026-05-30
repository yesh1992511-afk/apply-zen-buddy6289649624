import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LogRow = {
  id: number | string;
  ts: string;
  level: string;
  scope: string | null;
  message: string;
};

const SCOPE_HEADLINE: Record<string, string> = {
  "resume.optimize": "Optimizing resume for this role",
  "resume.generate": "Generating tailored resume",
  "cover.generate": "Writing cover letter",
  "apply.submit": "Submitting application",
  "apply.submitted": "Application submitted",
  "apply.failed": "Application failed",
};

function levelColor(l: string) {
  if (l === "error") return "text-destructive";
  if (l === "warn") return "text-warning";
  if (l === "debug") return "text-muted-foreground/60";
  return "text-foreground/80";
}

export function LiveActivityPanel({ logs, active }: { logs: LogRow[]; active: boolean }) {
  const latest = logs[logs.length - 1];
  let headline = "Working…";
  if (latest) {
    if (latest.scope && SCOPE_HEADLINE[latest.scope]) headline = SCOPE_HEADLINE[latest.scope];
    else if (latest.scope?.startsWith("form.fill")) headline = `Filling: ${(latest.message || "form field")}`;
    else if (latest.scope) headline = latest.message || latest.scope;
    else headline = latest.message;
  }

  const tail = logs.slice(-6);

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-4 overflow-hidden">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="relative">
          {active ? (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/50 animate-ping" />
              <Loader2 className="relative h-4 w-4 text-primary animate-spin" />
            </>
          ) : (
            <span className="h-2 w-2 rounded-full bg-success block" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{active ? "Live activity" : "Idle"}</div>
          <div className="font-heading text-sm font-semibold truncate">{headline}</div>
        </div>
      </div>
      <div className="space-y-1 font-mono text-[11px] leading-relaxed max-h-40 overflow-y-auto">
        {tail.length === 0 ? (
          <p className="italic text-muted-foreground/60 py-2">Waiting for worker to pick up this application…</p>
        ) : (
          tail.map((l, i) => (
            <div
              key={l.id}
              className={cn("flex gap-2 animate-fade-in", i === tail.length - 1 && "font-semibold")}
            >
              <span className="text-muted-foreground/50 tabular-nums shrink-0">
                {new Date(l.ts).toLocaleTimeString([], { hour12: false })}
              </span>
              <span className={cn("min-w-0 truncate", levelColor(l.level))}>{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
