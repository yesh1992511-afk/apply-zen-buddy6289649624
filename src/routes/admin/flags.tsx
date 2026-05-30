import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listFeatureFlags, upsertFeatureFlag } from "@/lib/admin.functions";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/flags")({
  head: () => ({ meta: [{ title: "Feature flags — Admin" }] }),
  component: FlagsPage,
  errorComponent: ErrorBoundaryRoute,
});

type Flag = { key: string; enabled: boolean; rollout_pct: number; description: string | null };

function FlagsPage() {
  const list = useServerFn(listFeatureFlags);
  const upsert = useServerFn(upsertFeatureFlag);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const load = () => list().then((d) => setFlags(d as Flag[]));
  useEffect(() => { load(); }, []);
  useRealtimeInvalidate({ table: "feature_flags", onChange: load });

  const save = async (f: Flag) => {
    try {
      await upsert({ data: { key: f.key, enabled: f.enabled, rollout_pct: f.rollout_pct, description: f.description ?? undefined } });
      toast.success(`Saved ${f.key}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const add = async () => {
    if (!newKey.match(/^[a-z0-9_.-]+$/)) return toast.error("Key must be lowercase alphanumeric + _.-");
    try {
      await upsert({ data: { key: newKey, enabled: false, rollout_pct: 0, description: newDesc } });
      setNewKey(""); setNewDesc("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Create flag</h3>
        <div className="flex gap-2">
          <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="flag_key" className="max-w-[200px] font-mono text-xs" />
          <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="text-xs" />
          <Button size="sm" onClick={add}>Add</Button>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40">
        {flags.length === 0
          ? <div className="px-4 py-8 text-center text-xs text-muted-foreground">No flags yet.</div>
          : flags.map((f) => (
            <div key={f.key} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-semibold">{f.key}</div>
                {f.description && <div className="truncate text-[11px] text-muted-foreground">{f.description}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Rollout</span>
                <Input
                  type="number" min={0} max={100}
                  value={f.rollout_pct}
                  onChange={(e) => setFlags((arr) => arr.map((x) => x.key === f.key ? { ...x, rollout_pct: Number(e.target.value) } : x))}
                  className="h-8 w-16 text-xs tabular-nums"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <Switch checked={f.enabled} onCheckedChange={(v) => setFlags((arr) => arr.map((x) => x.key === f.key ? { ...x, enabled: v } : x))} />
              <Button size="sm" variant="outline" className="h-8" onClick={() => save(f)}>Save</Button>
            </div>
          ))}
      </div>
    </div>
  );
}
