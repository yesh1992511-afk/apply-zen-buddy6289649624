import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Copy, ExternalLink, Server } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Worker Setup — JobPilot" }] }),
  component: SetupPage,
});

type Heartbeat = { last_seen: string | null; version: string | null };

const SECRETS = [
  { name: "Supabase URL + service role", env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], help: "Cloud → Backend → Project Settings → API" },
  { name: "Apify (LinkedIn/Indeed scraping)", env: ["APIFY_TOKEN"], help: "console.apify.com → Settings → Integrations → API tokens" },
  { name: "OpenAI (resume tailoring)", env: ["OPENAI_API_KEY"], help: "platform.openai.com/api-keys" },
  { name: "DeepSeek (JD reasoning)", env: ["DEEPSEEK_API_KEY"], help: "platform.deepseek.com → API Keys" },
  { name: "Captcha solver", env: ["CAPTCHA_PROVIDER", "CAPTCHA_API_KEY"], help: "2Captcha / CapSolver / Anti-Captcha dashboard" },
  { name: "Residential proxies", env: ["PROXY_HOST", "PROXY_PORT", "PROXY_USER", "PROXY_PASS"], help: "IPRoyal / Smartproxy / BrightData dashboard" },
  { name: "Gmail OAuth (OTP reading)", env: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "GMAIL_OAUTH_REFRESH_TOKEN", "GMAIL_EMAIL"], help: "console.cloud.google.com → enable Gmail API → OAuth client" },
  { name: "Apply credentials", env: ["APPLY_EMAIL", "APPLY_PASSWORD", "APPLY_DEFAULT_PHONE"], help: "Any email/password the bot will use on portals" },
];

function SetupPage() {
  const [hb, setHb] = useState<Heartbeat | null>(null);
  const [userId, setUserId] = useState<string>("");

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Worker setup</h1>
        <p className="text-sm text-muted-foreground">
          The scraping + apply engine runs on your VPS, not on Lovable. Deploy the Docker bundle, then it shows up here.
        </p>
      </div>

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
          <CardTitle>1. Deploy on your VPS</CardTitle>
          <CardDescription>Tested on Ubuntu 22.04 / 24.04 (Hetzner CX22, ~€4/mo).</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
{`# 1) Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2) Clone your repo to the VPS
git clone <your-repo-url> jobpilot && cd jobpilot/worker

# 3) Configure secrets
cp .env.example .env
nano .env   # fill values (see SECRETS.md)

# 4) Build & run
docker compose up -d --build
docker compose logs -f worker`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Your user ID</CardTitle>
          <CardDescription>Paste this into the worker's <code>JOBPILOT_USER_ID</code> env var.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs">{userId || "—"}</code>
          <Button size="sm" variant="outline" onClick={() => copy(userId)}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Secrets checklist</CardTitle>
          <CardDescription>Fill each of these in your VPS <code>worker/.env</code>. Full step-by-step in <code>worker/SECRETS.md</code>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SECRETS.map((s) => (
            <div key={s.name} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.help}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.env.map((e) => (
                  <Badge key={e} variant="secondary" className="font-mono text-[10px]">{e}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Verify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>After <code>docker compose up</code> the worker should appear as <strong>Online</strong> above within 30 seconds. Then:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Configure at least one source in <a className="underline" href="/sources">Sources</a> and enable it.</li>
            <li>Create a filter in <a className="underline" href="/filters">Filters</a> and mark it default.</li>
            <li>Upload your <code>.tex</code> resume in <a className="underline" href="/profile">Profile</a>.</li>
            <li>Toggle automation on in <a className="underline" href="/automation">Automation</a>.</li>
          </ul>
          <p className="pt-2">
            Want to test once?
            <code className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">docker compose exec worker python -m app.cli scrape</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
