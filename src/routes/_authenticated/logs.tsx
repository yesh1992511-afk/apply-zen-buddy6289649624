import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ScrollText, Search, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs — JobPilot" }] }),
  component: LogsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type Log = { id: number; ts: string; level: string; scope: string | null; message: string };

const LEVEL_META: Record<string, { dot: string; text: string; bg: string }> = {
  debug: { dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-surface-2" },
  info:  { dot: "bg-success",          text: "text-success",          bg: "bg-success/10" },
  warn:  { dot: "bg-warning",          text: "text-warning",          bg: "bg-warning/10" },
  error: { dot: "bg-destructive",      text: "text-destructive",      bg: "bg-destructive/10" },
};

function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [level, setLevel] = useState<string>("all");
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("logs").select("id, ts, level, scope, message").order("ts", { ascending: false }).limit(500);
    if (level !== "all") query = query.eq("level", level as "debug" | "info" | "warn" | "error");
    if (q) query = query.ilike("message", `%${q}%`);
    const { data } = await query;
    setLogs((data ?? []) as Log[]);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [level]);

  useEffect(() => {
    const ch = supabase
      .channel("logs-tail")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (payload) => {
          const row = payload.new as Log;
          if (level !== "all" && row.level !== level) return;
          if (q && !row.message.toLowerCase().includes(q.toLowerCase())) return;
          setLogs((prev) => [row, ...prev].slice(0, 500));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [level, q]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Logs"
        description={`Live tail · last ${logs.length} events`}
        actions={
          <Button variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
        <ToggleGroup type="single" value={level} onValueChange={(v) => v && setLevel(v)} className="bg-surface-2 rounded-lg p-0.5">
          <ToggleGroupItem value="all" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md text-xs">All</ToggleGroupItem>
          <ToggleGroupItem value="debug" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md text-xs">Debug</ToggleGroupItem>
          <ToggleGroupItem value="info" className="data-[state=on]:bg-success data-[state=on]:text-success-foreground rounded-md text-xs">Info</ToggleGroupItem>
          <ToggleGroupItem value="warn" className="data-[state=on]:bg-warning data-[state=on]:text-warning-foreground rounded-md text-xs">Warn</ToggleGroupItem>
          <ToggleGroupItem value="error" className="data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground rounded-md text-xs">Error</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="pl-9 bg-surface-2 border-border/60"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        {logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No logs match"
            description={level !== "all" || q ? "Try clearing filters." : "Once the worker starts running, events stream here in real time."}
            className="border-none"
          />
        ) : (
          <div className="max-h-[70vh] overflow-auto font-mono text-xs">
            {logs.map((l) => {
              const meta = LEVEL_META[l.level] ?? LEVEL_META.debug;
              const fullLine = `${new Date(l.ts).toISOString()} [${l.level}] ${l.scope ?? ""} ${l.message}`;
              return (
                <div key={l.id} className="group flex items-start gap-2 border-b border-border/30 px-4 py-1.5 hover:bg-surface-2">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                  <span className="shrink-0 tabular-nums text-muted-foreground/70">{new Date(l.ts).toLocaleTimeString()}</span>
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", meta.bg, meta.text)}>
                    {l.level}
                  </span>
                  {l.scope && <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">{l.scope}</span>}
                  <span className="break-all leading-relaxed text-foreground/90 flex-1">{l.message}</span>
                  <button
                    type="button"
                    aria-label="Copy log line"
                    onClick={() => { navigator.clipboard.writeText(fullLine); toast.success("Copied"); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
