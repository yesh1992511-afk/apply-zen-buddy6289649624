import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Download, Plus, RefreshCw, Trash2, Chrome, ShieldCheck, Eye } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/extension")({
  head: () => ({ meta: [{ title: "Browser Extension — JobPilot" }] }),
  component: ExtensionPage,
});

type Token = {
  id: string;
  label: string;
  token: string;
  last_seen_at: string | null;
  captures_today: number;
  captures_total: number;
  created_at: string;
};

const SUPPORTED = [
  { key: "linkedin", name: "LinkedIn", host: "linkedin.com/jobs" },
  { key: "indeed", name: "Indeed", host: "indeed.com" },
  { key: "glassdoor", name: "Glassdoor", host: "glassdoor.com" },
  { key: "ziprecruiter", name: "ZipRecruiter", host: "ziprecruiter.com" },
  { key: "wellfound", name: "Wellfound", host: "wellfound.com" },
  { key: "dice", name: "Dice", host: "dice.com" },
];

function genToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "jpx_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function ExtensionPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: tk }, { data: jobs }] = await Promise.all([
      supabase.from("extension_tokens").select("*").order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("source_key")
        .like("source_key", "ext_%")
        .gte("scraped_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
    ]);
    setTokens((tk as Token[]) ?? []);
    const s: Record<string, number> = {};
    (jobs ?? []).forEach((j) => {
      const k = (j.source_key as string).replace("ext_", "");
      s[k] = (s[k] ?? 0) + 1;
    });
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const createToken = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const token = genToken();
    const { error } = await supabase.from("extension_tokens").insert({
      user_id: u.user.id,
      token,
      label: "My Browser",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Token created");
      load();
    }
  };

  const revokeToken = async (id: string) => {
    const { error } = await supabase.from("extension_tokens").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Revoked");
      load();
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
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
    } catch (e) {
      toast.error("Download failed: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browser Extension"
        description="Capture jobs from LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound and Dice — using your own logged-in browser. Zero ban risk."
      />

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="font-heading text-lg font-semibold">Why this is safe</h2>
            <p className="text-sm text-muted-foreground">
              The extension never logs in for you, never clicks Apply, never auto-scrolls. It only reads the jobs you're already viewing in your own browser and forwards them to your dashboard.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><Eye className="h-4 w-4 mt-0.5 text-primary" /> Read-only — no clicks, no form fills, no submissions</li>
          <li className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 mt-0.5 text-primary" /> Domain-locked to 6 job portals</li>
          <li className="flex items-start gap-2"><RefreshCw className="h-4 w-4 mt-0.5 text-primary" /> 10s throttle + 200–800ms random jitter</li>
          <li className="flex items-start gap-2"><Trash2 className="h-4 w-4 mt-0.5 text-primary" /> Revoke token anytime to kill access instantly</li>
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2"><Chrome className="h-5 w-5" /> Install in Chrome / Edge / Brave</h2>
            <p className="text-sm text-muted-foreground mt-1">One-time setup, ~30 seconds.</p>
          </div>
          <Button onClick={downloadZip}><Download className="h-4 w-4 mr-2" /> Download extension</Button>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground pl-2">
          <li>Download the ZIP above and unzip it anywhere.</li>
          <li>Open <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">chrome://extensions</code></li>
          <li>Turn on <strong>Developer mode</strong> (top-right toggle).</li>
          <li>Click <strong>Load unpacked</strong> → select the unzipped folder.</li>
          <li>Click the JobPilot icon → <strong>Settings</strong> → paste a pairing token from below.</li>
          <li>Browse LinkedIn / Indeed / etc. like normal. Jobs flow into your dashboard automatically.</li>
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Pairing tokens</h2>
          <Button size="sm" onClick={createToken}><Plus className="h-4 w-4 mr-2" /> New token</Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet. Create one to pair your first browser.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.label}</span>
                    {t.last_seen_at ? (
                      <span className="text-[10px] uppercase tracking-wider text-primary">● live · last seen {new Date(t.last_seen_at).toLocaleString()}</span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Awaiting first connection</span>
                    )}
                  </div>
                  <Input readOnly value={t.token} className="mt-1.5 font-mono text-xs h-8" />
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    {t.captures_today} captured today · {t.captures_total} total
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(t.token)}><Copy className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => revokeToken(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-heading text-lg font-semibold">Last 24 hours by portal</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SUPPORTED.map((s) => (
            <div key={s.key} className="rounded-lg border border-border p-3 bg-background/50">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.name}</div>
              <div className="font-heading text-2xl font-semibold mt-1">{stats[s.key] ?? 0}</div>
              <div className="text-[11px] text-muted-foreground">{s.host}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
