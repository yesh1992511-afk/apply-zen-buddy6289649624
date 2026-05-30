import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlans } from "@/lib/admin.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({ meta: [{ title: "Plans — Admin" }] }),
  component: BillingOpsPage,
  errorComponent: ErrorBoundaryRoute,
});

function BillingOpsPage() {
  const fetchPlans = useServerFn(listPlans);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => fetchPlans() });

  if (isLoading) return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading plans…</div>;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Failed to load plans: {(error as Error).message}</div>;

  const plans = (data ?? []) as any[];
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Read-only view of plans & quotas. Stripe payments are managed via the Billing page.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.key} className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-base font-semibold">{p.name}</h3>
              <div className="tabular-nums text-sm">${(p.price_cents / 100).toFixed(0)}<span className="text-xs text-muted-foreground">/mo</span></div>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>{p.max_applies_per_day} applies/day</li>
              <li>{p.max_sources} sources</li>
              <li>Cookie sync: {p.cookie_sync ? "✓" : "—"}</li>
              <li>Admin console: {p.admin_console ? "✓" : "—"}</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
