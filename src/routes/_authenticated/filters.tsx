import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Star, Filter as FilterIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { SavedIndicator, type SaveState } from "@/components/SavedIndicator";
import { FieldError } from "@/components/FieldError";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { filterSchema } from "@/lib/validation/settings";
import {
  filtersQueryOptions,
  useCreateFilter,
  useDeleteFilter,
  useSetDefaultFilter,
  useUpdateFilter,
  type Filter,
} from "@/lib/queries/filters";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export const Route = createFileRoute("/_authenticated/filters")({
  head: () => ({ meta: [{ title: "Filters — JobPilot" }] }),
  component: FiltersPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

function FiltersPage() {
  const filters = useQuery(filtersQueryOptions());
  const createMutation = useCreateFilter();

  useRealtimeInvalidate({ table: "filters", queryKey: ["filters", "all"] });

  if (filters.isError) {
    return <QueryErrorState error={filters.error as Error} onRetry={() => filters.refetch()} />;
  }

  const items = filters.data ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Filters"
        description="Only jobs matching at least one enabled filter show up in your feed. Edits save as you type."
        actions={
          <Button
            onClick={() => createMutation.mutate(items.length)}
            disabled={createMutation.isPending}
            className="bg-gradient-emerald gap-1.5"
          >
            <Plus className="h-4 w-4" /> New filter
          </Button>
        }
      />

      {items.map((f) => (
        <FilterRow key={f.id} filter={f} />
      ))}

      {items.length === 0 && !filters.isLoading && (
        <EmptyState
          icon={FilterIcon}
          title="No filters yet"
          description="Create a filter to control which jobs appear in your feed and qualify for auto-apply."
          action={
            <Button
              onClick={() => createMutation.mutate(0)}
              disabled={createMutation.isPending}
              className="bg-gradient-emerald"
            >
              <Plus className="mr-1 h-4 w-4" /> Create first filter
            </Button>
          }
        />
      )}
    </div>
  );
}

function FilterRow({ filter }: { filter: Filter }) {
  const update = useUpdateFilter();
  const setDefault = useSetDefaultFilter();
  const remove = useDeleteFilter();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async (patch: Partial<Filter>) => {
    const next = { ...filter, ...patch };
    const result = filterSchema.safeParse({
      ...next,
      // Schema treats arrays as optional; explicitly pass through.
      keywords: next.keywords ?? [],
      exclude_keywords: next.exclude_keywords ?? [],
      exclude_companies: next.exclude_companies ?? [],
      locations: next.locations ?? [],
      seniority: next.seniority ?? [],
      employment_type: next.employment_type ?? [],
    });
    if (!result.success) {
      const map: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!map[key]) map[key] = issue.message;
      }
      setErrors(map);
      setSaveState("error");
      setError("Invalid value");
      return;
    }
    setErrors({});
    setSaveState("saving");
    try {
      await update.mutateAsync({ id: filter.id, patch });
      setSaveState("saved");
      setError(null);
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <Card className="lift">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Input
              className="max-w-xs"
              defaultValue={filter.name}
              onBlur={(e) => {
                if (e.target.value !== filter.name) save({ name: e.target.value });
              }}
            />
            {filter.is_default && (
              <Badge variant="secondary">
                <Star className="mr-1 h-3 w-3" /> default
              </Badge>
            )}
            <FilterPreview filter={filter} />
            <SavedIndicator state={saveState} error={error} />
          </CardTitle>
          <FieldError message={errors.name} />
        </div>
        <div className="flex shrink-0 gap-2">
          {!filter.is_default && (
            <Button size="sm" variant="outline" onClick={() => setDefault.mutate(filter.id)}>
              Make default
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="Delete filter">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this filter?</AlertDialogTitle>
                <AlertDialogDescription>
                  Jobs matched only by &ldquo;{filter.name}&rdquo; will disappear from your feed.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => remove.mutate(filter.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <ArrField
          label="Keywords (any match)"
          value={filter.keywords}
          onChange={(v) => save({ keywords: v })}
        />
        <ArrField
          label="Exclude keywords"
          value={filter.exclude_keywords}
          onChange={(v) => save({ exclude_keywords: v })}
        />
        <ArrField
          label="Exclude companies"
          value={filter.exclude_companies}
          onChange={(v) => save({ exclude_companies: v })}
        />
        <ArrField
          label="Locations"
          value={filter.locations}
          onChange={(v) => save({ locations: v })}
        />
        <ArrField
          label="Seniority"
          value={filter.seniority}
          onChange={(v) => save({ seniority: v })}
        />
        <ArrField
          label="Employment type"
          value={filter.employment_type}
          onChange={(v) => save({ employment_type: v })}
        />
        <div>
          <Label>Salary min</Label>
          <Input
            type="number"
            defaultValue={filter.salary_min ?? ""}
            onBlur={(e) => {
              const next = e.target.value ? Number(e.target.value) : null;
              if (next !== filter.salary_min) save({ salary_min: next });
            }}
          />
          <FieldError message={errors.salary_min} />
        </div>
        <div>
          <Label>Posted within (hours)</Label>
          <Input
            type="number"
            defaultValue={filter.posted_within_hours}
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (next !== filter.posted_within_hours) save({ posted_within_hours: next });
            }}
          />
          <FieldError message={errors.posted_within_hours} />
        </div>
        <div>
          <Label>Min relevance score (0–100)</Label>
          <Input
            type="number"
            defaultValue={filter.min_score}
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (next !== filter.min_score) save({ min_score: next });
            }}
          />
          <FieldError message={errors.min_score} />
        </div>
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={filter.remote_only}
              onCheckedChange={(v) => save({ remote_only: v })}
            />{" "}
            Remote only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={filter.hybrid_ok} onCheckedChange={(v) => save({ hybrid_ok: v })} />{" "}
            Hybrid OK
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={filter.onsite_ok} onCheckedChange={(v) => save({ onsite_ok: v })} />{" "}
            Onsite OK
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

function ArrField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        defaultValue={(value ?? []).join(", ")}
        placeholder="comma-separated"
        onBlur={(e) => {
          const next = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const prev = (value ?? []).join("|");
          if (next.join("|") !== prev) onChange(next);
        }}
      />
    </div>
  );
}

function FilterPreview({ filter }: { filter: Filter }) {
  const [count, setCount] = useState<number | null>(null);
  const { debounced } = useDebouncedCallback(async () => {
    let q = supabase.from("jobs").select("id", { count: "exact", head: true });
    if (filter.min_score) q = q.gte("score", filter.min_score);
    if (filter.posted_within_hours) {
      const since = new Date(Date.now() - filter.posted_within_hours * 3600_000).toISOString();
      q = q.gte("scraped_at", since);
    }
    if ((filter.keywords ?? []).length > 0) {
      // Sanitize keywords to prevent PostgREST filter injection.
      // Strip characters with special meaning in the .or() mini-language: , . ( ) * : %
      const safe = filter.keywords
        .map((k) => k.replace(/[,.()*:%\\]/g, "").trim())
        .filter((k) => k.length > 0 && k.length <= 100);
      if (safe.length > 0) {
        const or = safe
          .map((k) => `title.ilike.%${k}%,description.ilike.%${k}%`)
          .join(",");
        q = q.or(or);
      }
    }
    const { count: c } = await q;
    setCount(c ?? 0);
  }, 350);
  useEffect(() => {
    debounced();
  }, [filter, debounced]);
  return (
    <Badge variant="outline" className="ml-1 gap-1 font-mono tabular-nums">
      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
      {count === null ? "…" : `${count} match`}
    </Badge>
  );
}
