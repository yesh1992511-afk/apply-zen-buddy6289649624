import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Loader2 } from "lucide-react";
import { runOneShotBatch } from "@/lib/applications.functions";
import { toast } from "@/lib/toast";

/**
 * One-click batch runner: scrape until N matched jobs land, then stop.
 * The apply worker submits them automatically (pg_cron).
 */
export function RunBatchButton({ defaultTarget = 10 }: { defaultTarget?: number }) {
  const [target, setTarget] = useState<number>(defaultTarget);
  const qc = useQueryClient();
  const runBatch = useServerFn(runOneShotBatch);

  const mutation = useMutation({
    mutationFn: (t: number) => runBatch({ data: { target: t } }),
    onSuccess: (r) => {
      toast.success(
        `Matched ${r.matched}/${r.target} jobs (fetched ${r.fetched}). Tailored resume + cover letter are being prepared — review and 1-click submit from Applications.`,
      );
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["job-counts"] });
      qc.invalidateQueries({ queryKey: ["daily-apply-budget"] });
    },
    onError: (e: Error) => toast.error(e.message || "Batch failed"),
  });

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-2/60 p-1 pl-2">
      <span className="text-[11px] font-medium text-muted-foreground">Get</span>
      <Input
        type="number"
        min={1}
        max={50}
        value={target}
        onChange={(e) => setTarget(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
        className="h-7 w-14 px-1 text-center text-xs tabular-nums bg-background"
        disabled={mutation.isPending}
        aria-label="Batch target"
      />
      <Button
        size="sm"
        onClick={() => mutation.mutate(target)}
        disabled={mutation.isPending}
        className="h-7 gap-1.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
      >
        {mutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        {mutation.isPending ? "Running…" : "Match & prepare"}
      </Button>
    </div>
  );
}
