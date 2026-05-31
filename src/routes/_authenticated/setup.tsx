import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Copy, Server, Shield, Zap, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { ReadinessChecklist, useReadiness } from "@/components/ReadinessChecklist";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Worker Setup — JobPilot" }] }),
  component: SetupPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type Heartbeat = { last_seen: string | null; version: string | null };

function SetupPage() {
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [testing, setTesting] = useState<"sources" | "apply" | null>(null);
  const [pipelineResult, setPipelineResult] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
    const load = () =>
      supabase.from("worker_heartbeat").select("last_seen, version").maybeSingle().then(({ data }) => {
        setHb(data as Heartbeat | null);
      });
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const stale = !hb?.last_seen || Date.now() - new Date(hb.last_seen).getTime() > 3 * 60_000;

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  };

  const runSources = async () => {
    if (!userId) return;
    setTesting("sources");
    setPipelineResult(null);
    try {
      const res = await fetch(`/api/public/sources/run-tier?tier=hot&user_id=${userId}`);
      const json = await res.json() as { ok?: boolean; summary?: Record<string, { fetched: number; inserted: number }> };
      const totals = Object.values(json.summary ?? {}).reduce(
        (a, b) => ({ fetched: a.fetched + b.fetched, inserted: a.inserted + b.inserted }),
        { fetched: 0, inserted: 0 },
      );
      setPipelineResult(`Step 1 ✓ Fetched ${totals.fetched} jobs · ${totals.inserted} newly inserted`);
      toast.success(`Fetched ${totals.fetched} jobs · ${totals.inserted} new`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setTesting(null);
    }
  };

  const runApplyWorker = async () => {
    setTesting("apply");
    try {
      const res = await fetch("/api/public/hooks/apply-worker");
      const json = await res.json() as { ok?: boolean; processed?: number; results?: Array<{ id: string; status: string; error?: string }> };
      const okCount = (json.results ?? []).filter((r) => r.status === "ok").length;
      setPipelineResult(`Step 2 ✓ Apply worker processed ${json.processed ?? 0} application(s) · ${okCount} ok`);
      toast.success(`Worker processed ${json.processed ?? 0}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setTesting(null);
    }
  };

  const sshCmd = "ssh root@147.93.47.24";
  const deployCmd = `cd /root/jobpilot/worker && bash bootstrap.sh`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Worker setup"
        description="Verify the system end-to-end with one click, then read the optional VPS instructions below."
      />

      {/* Mac-level "Test pipeline" card — the most important thing on this page */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Test the pipeline
          </CardTitle>
          <CardDescription>
            Run the two cron-driven workers on demand. Step 1 fetches jobs from all enabled sources.
            Step 2 picks the oldest queued application and runs resume → cover → submit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={runSources} disabled={testing !== null} className="gap-2 bg-gradient-emerald">
              {testing === "sources" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              1. Fetch jobs now
            </Button>
            <Button onClick={runApplyWorker} disabled={testing !== null} variant="outline" className="gap-2">
              {testing === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              2. Run apply worker
            </Button>
          </div>
          {pipelineResult && (
            <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-foreground">
              {pipelineResult}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tip: press <kbd className="rounded border border-border/60 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> anywhere
            to open the command palette and run these without leaving the page.
          </p>
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" /> Worker status
            </CardTitle>
            <CardDescription>Heartbeats every 30 seconds.</CardDescription>
          </div>
          {stale ? (
            <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Offline</Badge>
          ) : (
            <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Online
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div><span className="text-muted-foreground">Version:</span> {hb?.version ?? "—"}</div>
          <div>
            <span className="text-muted-foreground">Last seen:</span>{" "}
            {hb?.last_seen ? formatDistanceToNow(new Date(hb.last_seen), { addSuffix: true }) : "never"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your user ID</CardTitle>
          <CardDescription>This is wired into <code>worker/.env</code> as <code>JOBPILOT_USER_ID</code>.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{userId || "—"}</code>
          <Button size="sm" variant="outline" onClick={() => copy(userId)}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>One-shot VPS install</CardTitle>
          <CardDescription>
            SSH in, scp the <code>worker/</code> folder to <code>/root/jobpilot/worker</code>,
            paste your user ID into <code>.env</code>, then run the bootstrap script.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">1. SSH in</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs">{sshCmd}</code>
              <Button size="sm" variant="outline" onClick={() => copy(sshCmd)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              2. From your laptop, push the worker folder
            </div>
            <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              scp -r worker root@147.93.47.24:/root/jobpilot/
            </code>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              3. Edit <code>JOBPILOT_USER_ID</code> + <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>/root/jobpilot/worker/.env</code>
            </div>
            <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              nano /root/jobpilot/worker/.env
            </code>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">4. Run the bootstrap</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs">{deployCmd}</code>
              <Button size="sm" variant="outline" onClick={() => copy(deployCmd)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Anti-detection stack
          </CardTitle>
          <CardDescription>What's already wired into every browser session.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="ml-5 list-disc space-y-1 text-sm">
            <li><strong>Decodo residential proxies</strong> — sticky session per portal, rotating exit IPs.</li>
            <li><strong>20-fingerprint pool</strong> — UA + sec-ch-ua client hints + viewport + locale + timezone, matched per OS.</li>
            <li><strong>Persistent browser profiles</strong> — cookies, cache, IndexedDB survive restarts (looks like a returning user).</li>
            <li><strong>playwright-stealth</strong> — patches <code>navigator.webdriver</code>, plugins, WebGL, etc.</li>
            <li><strong>Token-bucket rate limiter</strong> — LinkedIn 30/hr, Indeed 60/hr, Greenhouse 120/hr.</li>
            <li><strong>Circuit breaker</strong> — 3 challenges in 10 min → portal paused 2 hours.</li>
            <li><strong>Gaussian humanizer</strong> — clicks, scrolls, keystrokes scaled by aggressiveness 1–5.</li>
            <li><strong>CapSolver</strong> wired in for reCAPTCHA v2/v3.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verify end-to-end</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>After bootstrap, the worker should flip to <strong>Online</strong> within 30 seconds. Then:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Enable a source in <a className="underline" href="/sources">Sources</a> (LinkedIn, ZipRecruiter, or Google Jobs are pre-seeded).</li>
            <li>Set a default filter in <a className="underline" href="/filters">Filters</a>.</li>
            <li>Upload your <code>.tex</code> resume in <a className="underline" href="/profile">Profile</a>.</li>
            <li>Toggle automation on in <a className="underline" href="/automation">Automation</a>.</li>
          </ul>
          <p className="pt-2">
            Manual scrape test:
            <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
              docker compose exec worker python -m app.cli scrape
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
