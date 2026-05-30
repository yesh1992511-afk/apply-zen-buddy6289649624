import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;
  align?: "left" | "right" | "center";
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchKeys?: (row: T) => string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty?: ReactNode;
  exportFilename?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchKeys,
  initialSort,
  pageSize = 50,
  empty,
  exportFilename,
  onRowClick,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let out = rows;
    if (query && searchKeys) {
      const q = query.toLowerCase();
      out = out.filter((r) => searchKeys(r).toLowerCase().includes(q));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const va = col.sortValue!(a) ?? "";
          const vb = col.sortValue!(b) ?? "";
          const d = va > vb ? 1 : va < vb ? -1 : 0;
          return sort.dir === "asc" ? d : -d;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const exportCsv = () => {
    const head = columns.map((c) => `"${c.header}"`).join(",");
    const body = filtered.map((row) =>
      columns.map((c) => {
        const v = c.sortValue ? c.sortValue(row) : "";
        return `"${String(v ?? "").replace(/"/g, '""')}"`;
      }).join(","),
    ).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFilename ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchKeys && (
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="Search…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{filtered.length} rows</span>
          {exportFilename && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCsv}>
              <Download className="h-3 w-3" /> CSV
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 bg-surface-2/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key}
                    className={cn("px-3 py-2 font-semibold text-left", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                  {c.sortValue ? (
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {c.header}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  {empty ?? "No rows."}
                </td>
              </tr>
            ) : view.map((row) => (
              <tr key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn("border-b border-border/30 transition-colors", onRowClick && "cursor-pointer hover:bg-surface-2/40")}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2 align-middle", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}>
                    {c.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" className="h-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="tabular-nums text-muted-foreground">{page + 1} / {pages}</span>
          <Button size="sm" variant="outline" className="h-7" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
