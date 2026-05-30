import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBillingOverview } from "@/lib/billing.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Check, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — JobPilot" }] }),
  component: BillingPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

function BillingPage() {
  const fetchOverview = useServerFn(getBillingOverview);
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchOverview().then(setData); }, []);

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const currentKey = data.subscription?.plan_key ?? "free";
  const currentPlan = data.plans.find((p: any) => p.key === currentKey);
  const usedApplies = data.quota?.applies_count ?? 0;
  const isOwner = Boolean(data.isOwner);
  const limit = isOwner ? Infinity : (currentPlan?.max_applies_per_day ?? 10);
  const pct = isOwner ? 0 : Math.min(100, (usedApplies / limit) * 100);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <PageHeader title="Billing" description="Plan, usage and invoices." />

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><CreditCard className="h-3 w-3" /> Current plan</div>
            <div className="mt-1 flex items-center gap-2 font-heading text-2xl font-semibold">
              {isOwner ? "Owner" : (currentPlan?.name ?? "Free")}
              {isOwner && (
                <span className="rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-semibold text-gold-foreground">UNLIMITED</span>
              )}
            </div>
            {!isOwner && data.subscription?.trial_ends_at && new Date(data.subscription.trial_ends_at) > new Date() && (
              <div className="mt-1 inline-flex rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                Trial ends {new Date(data.subscription.trial_ends_at).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{isOwner ? "$0" : `$${((currentPlan?.price_cents ?? 0) / 100).toFixed(0)}`}</div>
            <div className="text-xs text-muted-foreground">/month</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Applies today</span>
            <span className="tabular-nums font-medium">{usedApplies} / {isOwner ? "∞" : limit}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className={cn("h-full transition-all", isOwner ? "bg-gradient-gold" : pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary")} style={{ width: `${isOwner ? 100 : pct}%` }} />
          </div>
          {isOwner && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              As the workspace owner you have unlimited applies, sources, and access to the admin console.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {data.plans.map((p: any) => {
          const active = !isOwner && p.key === currentKey;
          return (
            <div key={p.key} className={cn("rounded-xl border bg-card p-5", active ? "border-primary shadow-glow" : "border-border/60")}>
              <div className="flex items-baseline justify-between">
                <h3 className="font-heading text-lg font-semibold">{p.name}</h3>
                <div className="text-xl font-semibold tabular-nums">${(p.price_cents / 100).toFixed(0)}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
              </div>
              <ul className="mt-4 space-y-2 text-xs">
                <Feature>{p.max_applies_per_day} applies/day</Feature>
                <Feature>{p.max_sources} job sources</Feature>
                <Feature enabled={p.cookie_sync}>Encrypted cookie sync</Feature>
                <Feature enabled={p.admin_console}>Admin console</Feature>
              </ul>
              <Button className="mt-4 w-full" variant={active ? "secondary" : "default"} disabled={active || isOwner}>
                {isOwner ? "Owner — n/a" : active ? "Current plan" : "Upgrade"}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">Payments are not yet enabled. Plan upgrades will go live once Stripe is configured.</p>
    </div>
  );
}


function Feature({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  return (
    <li className={cn("flex items-center gap-1.5", !enabled && "text-muted-foreground/50")}>
      <Check className={cn("h-3 w-3", enabled ? "text-success" : "text-muted-foreground/30")} />
      {children}
    </li>
  );
}
