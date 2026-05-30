import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ApplyStepper, deriveStep } from "@/components/ApplyStepper";
import { LiveActivityPanel, type LogRow } from "@/components/LiveActivityPanel";
import { FormFillTable, type FillRow } from "@/components/FormFillTable";
import { PortalBadge } from "@/components/PortalBadge";
import { timeAgo } from "@/lib/timeAgo";
import { ExternalLink, FileText, Mail, ClipboardList, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/applications/$id")({
  head: () => ({ meta: [{ title: "Application — JobPilot" }] }),
  component: ApplicationDetailPage,
  
  errorComponent: ({ error }) => (
    <div className="p-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Application not found.</div>
  ),
});

type AppRow = {
  id: string;
  status: string;
  job_id: string;
  resume_id: string | null;
  cover_letter_id: string | null;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  applied_at: string | null;
  finished_at: string | null;
  screenshots: string[] | null;
  job: {
    title: string; company: string; url: string; source_key: string;
    location: string | null; remote: string | null; posted_at: string | null;
    scraped_at: string;
  } | null;
};

type ResumeRow = { id: string; name: string; pdf_storage_path: string | null; kind: string };

const ACTIVE_STATUSES = new Set(["queued", "applying", "optimizing", "generating_resume", "generating_cover", "submitting", "filling_form"]);

function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [app, setApp] = useState<AppRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [resume, setResume] = useState<ResumeRow | null>(null);
  const [coverLetter, setCoverLetter] = useState<ResumeRow | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [tab, setTab] = useState("form");
  const [loading, setLoading] = useState(true);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, job_id, resume_id, cover_letter_id, attempts, last_error, queued_at, started_at, applied_at, finished_at, screenshots, job:jobs(title, company, url, source_key, location, remote, posted_at, scraped_at)")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) { toast.error(error.message); setLoading(false); return; }
      if (!data) { throw notFound(); }
      setApp(data as unknown as AppRow);
      const { data: logRows } = await supabase
        .from("logs")
        .select("id, ts, level, scope, message")
        .eq("application_id", id)
        .order("ts", { ascending: true })
        .limit(500);
      if (!cancelled) setLogs((logRows ?? []) as LogRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Realtime: application + logs
  useEffect(() => {
    const ch = supabase
      .channel(`app-detail-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "applications", filter: `id=eq.${id}` },
        (p) => setApp((prev) => prev ? { ...prev, ...(p.new as Partial<AppRow>) } : prev))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs", filter: `application_id=eq.${id}` },
        (p) => setLogs((prev) => [...prev, p.new as LogRow]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  // Fetch resume rows when ids change
  useEffect(() => {
    (async () => {
      const ids = [app?.resume_id, app?.cover_letter_id].filter(Boolean) as string[];
      if (ids.length === 0) return;
      const { data } = await supabase
        .from("resumes")
        .select("id, name, pdf_storage_path, kind")
        .in("id", ids);
      const list = (data ?? []) as ResumeRow[];
      const r = list.find((x) => x.id === app?.resume_id) ?? null;
      const c = list.find((x) => x.id === app?.cover_letter_id) ?? null;
      setResume(r);
      setCoverLetter(c);
      if (r?.pdf_storage_path) {
        const { data: s } = await supabase.storage.from("resumes").createSignedUrl(r.pdf_storage_path, 3600);
        setResumeUrl(s?.signedUrl ?? null);
      }
      if (c?.pdf_storage_path) {
        const { data: s } = await supabase.storage.from("resumes").createSignedUrl(c.pdf_storage_path, 3600);
        setCoverUrl(s?.signedUrl ?? null);
      }
    })();
  }, [app?.resume_id, app?.cover_letter_id]);

  const lastScope = logs.length > 0 ? logs[logs.length - 1].scope : null;
  const activeIdx = app ? deriveStep(app.status, lastScope) : 0;
  const isActive = app ? ACTIVE_STATUSES.has(app.status) : false;
  const isDone = app?.status === "applied" || app?.status === "submitted";

  const fillRows: FillRow[] = useMemo(() => {
    return logs
      .filter((l) => (l.scope ?? "").startsWith("form.fill"))
      .map((l) => {
        // Try to parse "field => value" or use message
        const m = /^(.*?)\s*(?:=>|:|→)\s*(.+)$/.exec(l.message ?? "");
        return {
          id: l.id,
          field: m?.[1]?.trim() || l.scope?.replace(/^form\.fill\.?/, "") || "field",
          value: m?.[2]?.trim() || l.message,
          ts: l.ts,
        };
      });
  }, [logs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!app) return null;

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.history.back()} className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-xl font-bold">{app.job?.company}</h1>
            <span className="text-muted-foreground">·</span>
            <h2 className="text-lg text-muted-foreground">{app.job?.title}</h2>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {app.job?.source_key && <PortalBadge source={app.job.source_key} size="sm" />}
            {app.job?.location && <span>{app.job.location}{app.job.remote ? ` · ${app.job.remote}` : ""}</span>}
            <span>Queued {timeAgo(app.queued_at)}</span>
            {app.applied_at && <span className="text-success">Applied {timeAgo(app.applied_at)}</span>}
          </div>
        </div>
        {app.job?.url && (
          <Button asChild variant="outline" size="sm">
            <a href={app.job.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />View job posting
            </a>
          </Button>
        )}
      </div>

      <ApplyStepper activeIdx={activeIdx} status={app.status} />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Left rail */}
        <aside className="space-y-3">
          {isDone && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="font-semibold text-sm">Application completed</div>
                <div className="text-xs text-muted-foreground">Submitted to {app.job?.company}</div>
              </div>
            </div>
          )}
          {app.last_error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {app.last_error}
            </div>
          )}
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2">View</div>
          <nav className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {[
              { v: "form", label: "Form", icon: ClipboardList },
              { v: "resume", label: "Resume", icon: FileText },
              { v: "cover", label: "Cover letter", icon: Mail },
            ].map((it) => (
              <button
                key={it.v}
                onClick={() => setTab(it.v)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors text-left border-l-2",
                  tab === it.v
                    ? "bg-primary/10 border-l-primary text-foreground font-medium"
                    : "border-l-transparent text-muted-foreground hover:text-foreground hover:bg-surface-2",
                )}
              >
                <it.icon className="h-4 w-4" />{it.label}
              </button>
            ))}
            {app.job?.url && (
              <a href={app.job.url} target="_blank" rel="noreferrer" className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 border-t border-border/40 border-l-2 border-l-transparent">
                <ExternalLink className="h-4 w-4" />View job posting
              </a>
            )}
          </nav>
        </aside>

        {/* Right pane */}
        <div className="space-y-4 min-w-0">
          <LiveActivityPanel logs={logs} active={isActive} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="hidden">
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="cover">Cover</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="mt-0">
              <FormFillTable rows={fillRows} isActive={isActive} />
            </TabsContent>
            <TabsContent value="resume" className="mt-0">
              <PdfViewer url={resumeUrl} title={resume?.name ?? "Tailored resume"} isGenerating={isActive && !resumeUrl} />
            </TabsContent>
            <TabsContent value="cover" className="mt-0">
              <PdfViewer url={coverUrl} title={coverLetter?.name ?? "Cover letter"} isGenerating={isActive && !coverUrl} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function PdfViewer({ url, title, isGenerating }: { url: string | null; title: string; isGenerating: boolean }) {
  if (url) {
    return (
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm font-medium">{title}</h3>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <iframe src={url} className="w-full h-[70vh] bg-white" title={title} />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
      {isGenerating ? (
        <>
          <Loader2 className="h-6 w-6 text-primary mx-auto mb-3 animate-spin" />
          <p className="text-sm font-medium">Generating {title.toLowerCase()}…</p>
          <p className="text-xs text-muted-foreground mt-1">This usually takes 10–30 seconds.</p>
          <div className="mt-4 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-emerald animate-pulse" />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">Not generated yet.</p>
      )}
    </div>
  );
}
