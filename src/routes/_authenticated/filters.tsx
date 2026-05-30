import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Star, Filter as FilterIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/filters")({
  head: () => ({ meta: [{ title: "Filters — JobPilot" }] }),
  component: FiltersPage,
});

type Filter = {
  id: string;
  name: string;
  is_default: boolean;
  keywords: string[];
  exclude_keywords: string[];
  exclude_companies: string[];
  locations: string[];
  remote_only: boolean;
  hybrid_ok: boolean;
  onsite_ok: boolean;
  salary_min: number | null;
  posted_within_hours: number;
  seniority: string[];
  employment_type: string[];
  min_score: number;
};

function FiltersPage() {
  const { user } = useUser();
  const [items, setItems] = useState<Filter[]>([]);

  const load = () => supabase.from("filters").select("*").order("created_at").then(({ data }) => setItems((data ?? []) as Filter[]));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!user) return;
    const { error } = await supabase.from("filters").insert({ user_id: user.id, name: "New filter", is_default: items.length === 0 });
    if (error) toast.error(error.message); else load();
  };

  const update = async (id: string, patch: Partial<Filter>) => {
    const { error } = await supabase.from("filters").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("filters").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("filters").update({ is_default: true }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("filters").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Filters"
        description="Only jobs matching at least one enabled filter show up in your feed."
        actions={
          <Button onClick={add} className="bg-gradient-emerald gap-1.5"><Plus className="h-4 w-4" /> New filter</Button>
        }
      />


      {items.map((f) => (
        <Card key={f.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Input className="max-w-xs" defaultValue={f.name} onBlur={(e) => update(f.id, { name: e.target.value })} />
              {f.is_default && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" /> default</Badge>}
            </CardTitle>
            <div className="flex gap-2">
              {!f.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(f.id)}>Make default</Button>}
              <Button size="sm" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <ArrField label="Keywords (any match)" value={f.keywords} onChange={(v) => update(f.id, { keywords: v })} />
            <ArrField label="Exclude keywords" value={f.exclude_keywords} onChange={(v) => update(f.id, { exclude_keywords: v })} />
            <ArrField label="Exclude companies" value={f.exclude_companies} onChange={(v) => update(f.id, { exclude_companies: v })} />
            <ArrField label="Locations" value={f.locations} onChange={(v) => update(f.id, { locations: v })} />
            <ArrField label="Seniority" value={f.seniority} onChange={(v) => update(f.id, { seniority: v })} />
            <ArrField label="Employment type" value={f.employment_type} onChange={(v) => update(f.id, { employment_type: v })} />
            <div>
              <Label>Salary min</Label>
              <Input type="number" defaultValue={f.salary_min ?? ""} onBlur={(e) => update(f.id, { salary_min: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <Label>Posted within (hours)</Label>
              <Input type="number" defaultValue={f.posted_within_hours} onBlur={(e) => update(f.id, { posted_within_hours: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Min relevance score (0-100)</Label>
              <Input type="number" defaultValue={f.min_score} onBlur={(e) => update(f.id, { min_score: Number(e.target.value) })} />
            </div>
            <div className="flex flex-wrap items-center gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm"><Switch defaultChecked={f.remote_only} onCheckedChange={(v) => update(f.id, { remote_only: v })} /> Remote only</label>
              <label className="flex items-center gap-2 text-sm"><Switch defaultChecked={f.hybrid_ok} onCheckedChange={(v) => update(f.id, { hybrid_ok: v })} /> Hybrid OK</label>
              <label className="flex items-center gap-2 text-sm"><Switch defaultChecked={f.onsite_ok} onCheckedChange={(v) => update(f.id, { onsite_ok: v })} /> Onsite OK</label>
            </div>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && (
        <EmptyState
          icon={FilterIcon}
          title="No filters yet"
          description="Create a filter to control which jobs appear in your feed and qualify for auto-apply."
          action={<Button onClick={add} className="bg-gradient-emerald"><Plus className="mr-1 h-4 w-4" /> Create first filter</Button>}
        />
      )}
    </div>
  );
}

function ArrField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input defaultValue={value.join(", ")} placeholder="comma-separated" onBlur={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
    </div>
  );
}
