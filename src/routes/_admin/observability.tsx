import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { DataTable, type Column } from "@/components/DataTable";
import { MetricTile } from "@/components/MetricTile";
import { AlertOctagon, CheckCircle2, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin/observability")({
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
  const [errors, setErrors] = useState<ErrEvt[]>([]);
  const [stats, setStats] = useState({ open: 0, resolved: 0, last_24h: 0 });

  const load = () => {
    supabase.from("error_events").select("*").order("last_seen", { ascending: false }).limit(500).then(({ data }) => {
      const rows = (data ?? []) as ErrEvt[];
      setErrors(rows);
      const dayAgo = Date.now() - 86400_000;
      setStats({
        open: rows.filter((r) => !r.resolved).length,
        resolved: rows.filter((r) => r.resolved).length,
        last_24h: rows.filter((r) => new Date(r.last_seen).getTime() > dayAgo).length,
      });
    });
  };
  useEffect(load, []);
  useRealtimeInvalidate({ table: "error_events", onChange: load });

  const toggleResolved = async (e: ErrEvt) => {
    await supabase.from("error_events").update({ resolved: !e.resolved }).eq("id", e.id);
    load();
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
      accessor: (r) => <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); toggleResolved(r); }}>{r.resolved ? "Reopen" : "Resolve"}</Button>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricTile icon={AlertOctagon} label="Open errors" value={stats.open} accent={stats.open > 0 ? "danger" : "default"} />
        <MetricTile icon={Clock} label="Errors (24h)" value={stats.last_24h} accent="gold" />
        <MetricTile icon={Activity} label="Resolved" value={stats.resolved} accent="success" />
      </div>
      <DataTable
        rows={errors}
        columns={columns}
        rowKey={(r) => r.id}
        searchKeys={(r) => `${r.message} ${r.source} ${r.route ?? ""}`}
        exportFilename="error_events"
        empty="No errors logged yet. 🎉"
      />
    </div>
  );
}
