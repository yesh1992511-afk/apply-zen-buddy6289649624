import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError, toastSaved } from "@/lib/toast";
import {
  Copy, Download, Plus, RefreshCw, Trash2, ShieldCheck, Eye,
  Check, KeyRound, FolderOpen, PlugZap, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorState } from "@/components/QueryErrorState";
import { cn } from "@/lib/utils";
import {
  extensionTokensQueryOptions,
  extensionCapturesQueryOptions,
  useCreateExtensionToken,
  useRevokeExtensionToken,
} from "@/lib/queries/extension";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";

export const Route = createFileRoute("/_authenticated/extension")({
  head: () => ({ meta: [{ title: "Browser Extension — JobPilot" }] }),
  component: ExtensionPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

const SUPPORTED = [
  { key: "linkedin", name: "LinkedIn", host: "linkedin.com/jobs" },
  { key: "indeed", name: "Indeed", host: "indeed.com" },
  { key: "glassdoor", name: "Glassdoor", host: "glassdoor.com" },
  { key: "ziprecruiter", name: "ZipRecruiter", host: "ziprecruiter.com" },
  { key: "wellfound", name: "Wellfound", host: "wellfound.com" },
  { key: "dice", name: "Dice", host: "dice.com" },
];

function ExtensionPage() {
  const tokensQ = useQuery(extensionTokensQueryOptions());
  const statsQ = useQuery(extensionCapturesQueryOptions());
  const create = useCreateExtensionToken();
  const revoke = useRevokeExtensionToken();
  const [downloaded, setDownloaded] = useState(false);

  useRealtimeInvalidate({ table: "extension_tokens", queryKey: ["extension_tokens"] });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastSaved("Copied");
    } catch (e) {
      toastError(e);
    }
  };

  const downloadZip = async () => {
    try {
      const res = await fetch("/extension.zip");
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "jobpilot-extension.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      setDownloaded(true);
    } catch (e) {
      toastError(e, "Download failed");
    }
  };

  if (tokensQ.isError) {
    return <QueryErrorState error={tokensQ.error as Error} onRetry={() => tokensQ.refetch()} />;
  }

  const tokens = tokensQ.data ?? [];
  const stats = statsQ.data ?? {};
  const hasToken = tokens.length > 0;
  const hasPaired = tokens.some((t) => t.last_seen_at !== null);
  const currentStep = !hasToken ? 0 : !downloaded ? 1 : !hasPaired ? 2 : 3;
  const totalToday = Object.values(stats).reduce((a, b) => a + b, 0);
  const liveTokens = tokens.filter(
    (t) => t.last_seen_at && Date.now() - new Date(t.last_seen_at).getTime() < 5 * 60_000,
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Browser Extension"
        description="Capture jobs from LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound and Dice — using your own logged-in browser. Zero ban risk."
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-surface-2 px-3 py-1.5 sm:flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  liveTokens.length > 0 ? "bg-success animate-pulse-dot" : "bg-muted-foreground/50",
                )}
              />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {liveTokens.length > 0 ? `${liveTokens.length} browser live` : "No browser paired"}
              </span>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-surface-2 px-3 py-1.5 sm:flex">
              <Zap className="h-3 w-3 text-gold" />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{totalToday} today</span>
            </div>
          </div>
        }
      />

      {/* Wizard */}
      <div className="surface-frost rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Install in 4 steps</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            Step {Math.min(currentStep + 1, 4)} of 4
          </span>
        </div>

        <div className="mb-6 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500 ease-apple",
                i < currentStep ? "bg-gradient-emerald" : i === currentStep ? "bg-primary/60" : "bg-surface-3",
              )}
            />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <WizardStep
            n={1}
            icon={KeyRound}
            title="Generate token"
            desc="Creates a secure pairing key for your browser."
            done={hasToken}
            active={currentStep === 0}
            cta={
              !hasToken ? (
                <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create token
                </Button>
              ) : undefined
            }
          />
          <WizardStep
            n={2}
            icon={Download}
            title="Download"
            desc="One-time download of the unpacked extension ZIP."
            done={downloaded || currentStep > 1}
            active={currentStep === 1}
            cta={
              currentStep <= 1 ? (
                <Button
                  size="sm"
                  variant={currentStep === 1 ? "default" : "outline"}
                  onClick={downloadZip}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download .zip
                </Button>
              ) : undefined
            }
          />
          <WizardStep
            n={3}
            icon={FolderOpen}
            title="Load in browser"
            desc={
              <>
                Open <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10px]">chrome://extensions</code>,
                toggle Developer mode, click Load unpacked.
              </>
            }
            done={currentStep > 2}
            active={currentStep === 2}
          />
          <WizardStep
            n={4}
            icon={PlugZap}
            title="Paste token"
            desc="Open the JobPilot icon → Settings → paste the token from below."
            done={hasPaired}
            active={currentStep === 3}
          />
        </div>

        {hasPaired && (
          <div className="float-in mt-6 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
            <Check className="h-4 w-4 text-success" />
            <span className="text-foreground">Extension paired and capturing. You&rsquo;re done.</span>
          </div>
        )}
      </div>

      {/* Safety note */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading text-base font-semibold">Why this is safe</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The extension never logs in for you, never clicks Apply, never auto-scrolls. It only reads the jobs you&rsquo;re already viewing and forwards them to your dashboard.
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <li className="flex items-start gap-2"><Eye className="mt-0.5 h-4 w-4 text-primary" /> Read-only — no clicks, no form fills</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /> Domain-locked to 6 job portals</li>
              <li className="flex items-start gap-2"><RefreshCw className="mt-0.5 h-4 w-4 text-primary" /> 10s throttle + 200–800ms random jitter</li>
              <li className="flex items-start gap-2"><Trash2 className="mt-0.5 h-4 w-4 text-primary" /> Revoke token anytime to kill access instantly</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tokens */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Pairing tokens
            </h2>
            <p className="text-xs text-muted-foreground">One token per browser. Revoke anytime.</p>
          </div>
          <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New token
          </Button>
        </div>
        {tokensQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-16 rounded-lg shimmer" />)}
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet. Create one to pair your first browser.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => {
              const isLive =
                t.last_seen_at &&
                Date.now() - new Date(t.last_seen_at).getTime() < 5 * 60_000;
              return (
                <div key={t.id} className="row-in flex items-center gap-3 rounded-lg border border-border/60 bg-surface-1/50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.label}</span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-success">
                          <span className="h-1 w-1 rounded-full bg-success animate-pulse-dot" /> Live
                        </span>
                      ) : t.last_seen_at ? (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Last seen {new Date(t.last_seen_at).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Awaiting first connection
                        </span>
                      )}
                    </div>
                    <Input readOnly value={t.token} className="mt-1.5 h-8 font-mono text-xs" />
                    <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                      {t.captures_today} captured today · {t.captures_total} total
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Copy token" onClick={() => copy(t.token)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Revoke token"
                    onClick={() => revoke.mutate(t.id)}
                    disabled={revoke.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Portal grid */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold">Last 24 hours by portal</h2>
          <span className="text-xs tabular-nums text-muted-foreground">{totalToday} total</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {SUPPORTED.map((s) => {
            const n = stats[s.key] ?? 0;
            return (
              <div key={s.key} className="rounded-lg border border-border/60 bg-surface-1/50 p-3 lift">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.name}</div>
                  {n > 0 && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />}
                </div>
                <div className="mt-1 font-heading text-2xl font-semibold tabular-nums">{n}</div>
                <div className="text-[11px] text-muted-foreground">{s.host}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WizardStep({
  n, icon: Icon, title, desc, done, active, cta,
}: {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: React.ReactNode;
  done: boolean;
  active: boolean;
  cta?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all duration-300 ease-apple",
        done ? "border-success/40 bg-success/5" : active ? "border-primary/50 bg-primary/5 shadow-glow" : "border-border/60 bg-surface-1/50",
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
            done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-surface-3 text-muted-foreground",
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : n}
        </div>
        <Icon className={cn("h-4 w-4", done ? "text-success" : active ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</div>
      {cta && <div className="mt-3">{cta}</div>}
    </div>
  );
}
