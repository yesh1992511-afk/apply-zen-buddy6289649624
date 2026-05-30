import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dispatchWorkerCommand, getSystemSnapshot } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Pause, Play, RefreshCw, RotateCw, Send, Server, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/system")({
  head: () => ({ meta: [{ title: "System — Admin" }] }),
  component: SystemPage,
  errorComponent: ErrorBoundaryRoute,
});

type Snapshot = {
  heartbeat: { last_seen: string | null; version: string | null } | null;
  commands: Array<{ id: string; kind: string; status: string; created_at: string; finished_at: string | null; last_error: string | null }>;
  counts: { queued: number; applying: number; needs_review: number };
};

function SystemPage() {
  const fetchSnap = useServerFn(getSystemSnapshot);
  const dispatch = useServerFn(dispatchWorkerCommand);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "system"],
    queryFn: () => fetchSnap() as Promise<Snapshot>,
    refetchInterval: 5_000,
  });

  const send = async (kind: any) => {
    try {
      await dispatch({ data: { kind } });
      toast.success(`Dispatched ${kind}`);
      qc.invalidateQueries({ queryKey: ["admin", "system"] });
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border/60 bg-card/40 py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading system snapshot…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load system: {(error as Error)?.message ?? "unknown"}
      </div>
    );
  }

  const hb = data.heartbeat;
  const online = hb?.last_seen && Date.now() - new Date(hb.last_seen).getTime() < 5 * 60_000;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Server className="h-3 w-3" /> Worker
          </div>
          <div className={`mt-2 text-lg font-semibold ${online ? "text-success" : "text-destructive"}`}>
            {online ? "Online" : "Offline"}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
            {hb?.last_seen ? new Date(hb.last_seen).toLocaleTimeString() : "no signal"}
            {hb?.version && <> · v{hb.version}</>}
          </div>
        </div>
        <Tile label="Queued" value={data.counts.queued} />
        <Tile label="Applying" value={data.counts.applying} />
        <Tile label="Needs review" value={data.counts.needs_review} tone="warning" />
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Command center</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => send("refresh_sources")}><RefreshCw className="mr-1.5 h-3 w-3" />Refresh sources</Button>
          <Button size="sm" variant="outline" onClick={() => send("drain_apply_queue")}><Send className="mr-1.5 h-3 w-3" />Drain apply queue</Button>
          <Button size="sm" variant="outline" onClick={() => send("test_apply")}><RotateCw className="mr-1.5 h-3 w-3" />Test apply</Button>
          <Button size="sm" variant="outline" onClick={() => send("pause")}><Pause className="mr-1.5 h-3 w-3" />Pause worker</Button>
          <Button size="sm" variant="outline" onClick={() => send("resume")}><Play className="mr-1.5 h-3 w-3" />Resume worker</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/40 px-4 py-2.5 text-sm font-semibold">Recent commands</div>
        <div className="divide-y divide-border/30">
          {data.commands.length === 0 ? <div className="px-4 py-8 text-center text-xs text-muted-foreground">No commands yet.</div> : data.commands.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2 text-xs">
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{new Date(c.created_at).toLocaleTimeString()}</span>
              <span className="font-mono text-[11px]">{c.kind}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${c.status === "done" ? "bg-success/10 text-success" : c.status === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{c.status}</span>
              {c.last_error && <span className="ml-2 line-clamp-1 max-w-[300px] text-[10px] text-destructive">{c.last_error}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "warning" ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
