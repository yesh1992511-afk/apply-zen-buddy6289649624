import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_admin/plans")({
  head: () => ({ meta: [{ title: "Plans — Admin" }] }),
  component: BillingOpsPage,
  errorComponent: ErrorBoundaryRoute,
});

function BillingOpsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("plans").select("*").order("sort_order").then(({ data }) => setPlans(data ?? []));
  }, []);
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
