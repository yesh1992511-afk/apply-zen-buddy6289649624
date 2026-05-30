import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { DataTable, type Column } from "@/components/DataTable";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — Admin" }] }),
  component: AuditPage,
  errorComponent: ErrorBoundaryRoute,
});

type AuditRow = {
  id: number;
  ts: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
};

function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const load = () => {
    supabase.from("audit_log").select("id, ts, action, entity_type, entity_id, metadata").order("ts", { ascending: false }).limit(1000)
      .then(({ data }) => setRows((data ?? []) as AuditRow[]));
  };
  useEffect(load, []);
  useRealtimeInvalidate({ table: "audit_log", onChange: load });

  const columns: Column<AuditRow>[] = [
    { key: "ts", header: "When", accessor: (r) => new Date(r.ts).toLocaleString(), sortValue: (r) => r.ts },
    { key: "action", header: "Action", accessor: (r) => <span className="font-mono text-[10px]">{r.action}</span>, sortValue: (r) => r.action },
    { key: "entity_type", header: "Entity", accessor: (r) => r.entity_type, sortValue: (r) => r.entity_type },
    { key: "entity_id", header: "ID", accessor: (r) => <span className="font-mono text-[10px] text-muted-foreground">{r.entity_id ?? "—"}</span> },
    { key: "meta", header: "Meta", accessor: (r) => <span className="font-mono text-[10px] text-muted-foreground line-clamp-1">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : "—"}</span> },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => String(r.id)}
      searchKeys={(r) => `${r.action} ${r.entity_type} ${r.entity_id ?? ""}`}
      exportFilename="audit_log"
      empty="No audit entries yet."
    />
  );
}
