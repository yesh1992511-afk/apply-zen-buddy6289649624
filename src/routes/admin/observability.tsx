import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listErrorEvents, setErrorResolved } from "@/lib/admin.functions";
import { DataTable, type Column } from "@/components/DataTable";
import { MetricTile } from "@/components/MetricTile";
import { AlertOctagon, CheckCircle2, Clock, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/observability")({
  head: () => ({ meta: [{ title: "Observability — Admin" }] }),
  component: ObservabilityPage,
  errorComponent: ErrorBoundaryRoute,
});

type ErrEvt = {
  id: string;
  fingerprint: string;
  message: string;
  source: string;
  route: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved: boolean;
};

function ObservabilityPage() {
  const fetchErrors = useServerFn(listErrorEvents);
  const toggleFn = useServerFn(setErrorResolved);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "error_events"],
    queryFn: () => fetchErrors(),
    refetchInterval: 15_000,
  });

  const toggle = useMutation({
    mutationFn: (e: ErrEvt) => toggleFn({ data: { id: e.id, resolved: !e.resolved } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "error_events"] }),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const errors = (data ?? []) as ErrEvt[];
  const dayAgo = Date.now() - 86400_000;
  const stats = {
    open: errors.filter((r) => !r.resolved).length,
    resolved: errors.filter((r) => r.resolved).length,
    last_24h: errors.filter((r) => new Date(r.last_seen).getTime() > dayAgo).length,
  };

  const columns: Column<ErrEvt>[] = [
    {
      key: "status", header: "Status",
      accessor: (r) => r.resolved
        ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> resolved</span>
        : <span className="inline-flex items-center gap-1 text-destructive"><AlertOctagon className="h-3 w-3" /> open</span>,
      sortValue: (r) => r.resolved ? 1 : 0,
    },
    { key: "source", header: "Source", accessor: (r) => <span className="font-mono text-[10px] text-muted-foreground">{r.source}</span>, sortValue: (r) => r.source },
    { key: "message", header: "Message", accessor: (r) => <span className="line-clamp-1">{r.message}</span>, sortValue: (r) => r.message },
    { key: "route", header: "Route", accessor: (r) => <span className="text-muted-foreground">{r.route ?? "—"}</span> },
    { key: "count", header: "Count", accessor: (r) => r.count, sortValue: (r) => r.count, align: "right" },
    { key: "last_seen", header: "Last seen", accessor: (r) => new Date(r.last_seen).toLocaleString(), sortValue: (r) => r.last_seen, align: "right" },
    {
      key: "actions", header: "", align: "right",
      accessor: (r) => <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); toggle.mutate(r); }}>{r.resolved ? "Reopen" : "Resolve"}</Button>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricTile icon={AlertOctagon} label="Open errors" value={stats.open} accent={stats.open > 0 ? "danger" : "default"} />
        <MetricTile icon={Clock} label="Errors (24h)" value={stats.last_24h} accent="gold" />
        <MetricTile icon={Activity} label="Resolved" value={stats.resolved} accent="success" />
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-border/60 bg-card/40 py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading errors…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load errors: {(error as Error).message}
        </div>
      ) : (
        <DataTable
          rows={errors}
          columns={columns}
          rowKey={(r) => r.id}
          searchKeys={(r) => `${r.message} ${r.source} ${r.route ?? ""}`}
          exportFilename="error_events"
          empty="No errors logged yet. 🎉"
        />
      )}
    </div>
  );
}
