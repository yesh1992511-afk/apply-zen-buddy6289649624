import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Logs — JobPilot" }] }),
  component: LogsPage,
});

type Log = { id: number; ts: string; level: string; scope: string | null; message: string };

const COLORS: Record<string, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-yellow-500",
  error: "text-destructive",
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

  // Realtime tail
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">Last 500 worker events.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={level} onValueChange={(v) => v && setLevel(v)}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="debug">Debug</ToggleGroupItem>
          <ToggleGroupItem value="info">Info</ToggleGroupItem>
          <ToggleGroupItem value="warn">Warn</ToggleGroupItem>
          <ToggleGroupItem value="error">Error</ToggleGroupItem>
        </ToggleGroup>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="max-w-xs" />
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto font-mono text-xs">
            {logs.length === 0 && <div className="p-6 text-center text-muted-foreground">No logs yet.</div>}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2 border-b px-3 py-1.5 hover:bg-accent/30">
                <span className="shrink-0 text-muted-foreground">{new Date(l.ts).toLocaleTimeString()}</span>
                <Badge variant="outline" className={`shrink-0 text-[10px] ${COLORS[l.level] ?? ""}`}>{l.level}</Badge>
                {l.scope && <span className="shrink-0 text-muted-foreground">[{l.scope}]</span>}
                <span className="break-all">{l.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
