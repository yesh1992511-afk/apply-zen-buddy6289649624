import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/admin.functions";
import { DataTable, type Column } from "@/components/DataTable";
import { Loader2 } from "lucide-react";

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
  metadata: Record<string, unknown> | null;
  user_id: string | null;
};

function AuditPage() {
  const fetchAudit = useServerFn(listAuditLog);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "audit_log"],
    queryFn: () => fetchAudit(),
    refetchInterval: 30_000,
  });

  const rows = (data ?? []) as AuditRow[];

  const columns: Column<AuditRow>[] = [
    { key: "ts", header: "When", accessor: (r) => new Date(r.ts).toLocaleString(), sortValue: (r) => r.ts },
    { key: "action", header: "Action", accessor: (r) => <span className="font-mono text-[10px]">{r.action}</span>, sortValue: (r) => r.action },
    { key: "entity_type", header: "Entity", accessor: (r) => r.entity_type, sortValue: (r) => r.entity_type },
    { key: "entity_id", header: "ID", accessor: (r) => <span className="font-mono text-[10px] text-muted-foreground">{r.entity_id ?? "—"}</span> },
    { key: "meta", header: "Meta", accessor: (r) => {
      const m = r.metadata ?? {};
      return <span className="font-mono text-[10px] text-muted-foreground line-clamp-1">{Object.keys(m).length ? JSON.stringify(m) : "—"}</span>;
    } },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border/60 bg-card/40 py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading audit log…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load audit log: {(error as Error).message}
      </div>
    );
  }

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
