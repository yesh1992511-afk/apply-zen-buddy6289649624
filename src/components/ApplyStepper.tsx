import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepKey = "optimize" | "resume" | "generate" | "cover" | "submit" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "optimize", label: "Optimize" },
  { key: "resume", label: "Resume" },
  { key: "generate", label: "Generate" },
  { key: "cover", label: "Cover Letter" },
  { key: "submit", label: "Submit" },
  { key: "done", label: "Done" },
];

/** Map application.status + last log scope -> active step index */
export function deriveStep(status: string, lastScope?: string | null): number {
  if (status === "applied" || status === "submitted") return 5;
  if (status === "failed") return 4;
  switch (status) {
    case "queued": return 0;
    case "optimizing": return 1;
    case "generating_resume": return 2;
    case "generating_cover": return 3;
    case "submitting":
    case "filling_form":
    case "applying": return 4;
  }
  if (lastScope) {
    if (lastScope.startsWith("resume.optimize")) return 1;
    if (lastScope.startsWith("resume.generate")) return 2;
    if (lastScope.startsWith("cover")) return 3;
    if (lastScope.startsWith("form") || lastScope.startsWith("apply.submit")) return 4;
    if (lastScope.startsWith("apply.submitted")) return 5;
  }
  return 0;
}

export function ApplyStepper({ activeIdx, status }: { activeIdx: number; status: string }) {
  const isDone = status === "applied" || status === "submitted";
  const isFailed = status === "failed";

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
        <span className={cn("h-1.5 w-1.5 rounded-full",
          isFailed ? "bg-destructive" : isDone ? "bg-success" : "bg-primary animate-pulse")} />
        <span className={cn(isFailed ? "text-destructive" : isDone ? "text-success" : "text-primary")}>
          {isFailed ? "Failed" : isDone ? "Completed" : "In progress"}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const completed = i < activeIdx || isDone;
          const active = i === activeIdx && !isDone;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-center w-full">
                {i > 0 && <div className={cn("h-px flex-1", completed ? "bg-primary" : "bg-border/60")} />}
                <div className={cn(
                  "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                  completed && "bg-primary text-primary-foreground",
                  active && "bg-primary/15 text-primary ring-2 ring-primary animate-pulse",
                  !completed && !active && "bg-surface-2 text-muted-foreground border border-border/60",
                )}>
                  {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < activeIdx || isDone ? "bg-primary" : "bg-border/60")} />}
              </div>
              <span className={cn("text-[10px] font-medium text-center",
                completed || active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
