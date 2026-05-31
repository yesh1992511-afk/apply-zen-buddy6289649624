import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useUser } from "@/lib/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { compileResumeToPdf } from "@/lib/resume.functions";
import { Trash2, Upload, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "Resume — JobPilot" },
      { name: "description", content: "Manage LaTeX resume templates and preview compiled PDFs." },
    ],
  }),
  component: ResumePage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type Tpl = { id: string; name: string; tex_content: string | null; is_default: boolean | null; markers: unknown; pdf_storage_path: string | null; kind: string };
type PreviewMode = "template" | "tailored";

function DownloadPdfButton({ resumeId, name }: { resumeId: string; name: string }) {
  const compile = useServerFn(compileResumeToPdf);
  const [busy, setBusy] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await compile({ data: { resume_id: resumeId } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.name || `${name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Compile failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={busy} title="Compile & download PDF">
      <Download className="h-4 w-4" />
      {busy && <span className="ml-1 text-xs">…</span>}
    </Button>
  );
}

function ResumePage() {
  const { user } = useUser();
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [name, setName] = useState("My LaTeX resume");
  const [tex, setTex] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [topJobId, setTopJobId] = useState<string | null>(null);
  const [tailoredId, setTailoredId] = useState<string | null>(null);
  const [tailoredUrl, setTailoredUrl] = useState<string | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("template");

  const load = () => {
    supabase.from("resumes").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      const all = (data ?? []) as Tpl[];
      setTemplates(all.filter((r) => r.kind === "template" || r.kind === "synced"));
    });
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    supabase.from("jobs").select("id").order("score", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setTopJobId((data as { id: string } | null)?.id ?? null));
  }, []);

  useEffect(() => {
    if (!selectedId) { setPdfUrl(null); return; }
    const t = templates.find((x) => x.id === selectedId);
    if (!t) return;
    setEditing(t.tex_content ?? "");
    if (t.pdf_storage_path) {
      import("@/lib/commands").then(({ getResumePdfUrl }) =>
        getResumePdfUrl(t.pdf_storage_path!).then(setPdfUrl)
      );
    } else {
      setPdfUrl(null);
    }
  }, [selectedId, templates]);

  const detectMarkers = (s: string) => {
    const re = /%\s*LOV:([a-zA-Z0-9_:.-]+)/g;
    const out: string[] = [];
    let m;
    while ((m = re.exec(s))) if (m[1] !== "end") out.push(m[1]);
    return [...new Set(out)];
  };

  const upload = async () => {
    if (!user || !tex.trim()) return;
    const markers = detectMarkers(tex);
    const { data, error } = await supabase.from("resumes").insert({
      user_id: user.id, kind: "template", name, tex_content: tex,
      markers, is_default: templates.length === 0,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setTex("");
    load();
    setSelectedId(data.id);
    setPreviewMode("template");
    const { triggerCompileResume, waitForCommand, getResumePdfUrl, isWorkerOnline } = await import("@/lib/commands");
    const online = await isWorkerOnline();
    if (!online) {
      toast.warning(`Template saved (${markers.length} markers). Worker is offline — compile will run once it's back.`);
      await triggerCompileResume(data.id);
      return;
    }
    toast.success(`Template saved (${markers.length} markers). Compiling…`);
    setCompiling(true);
    try {
      const cid = await triggerCompileResume(data.id);
      if (!cid) return;
      const res = await waitForCommand(cid, 60_000);
      if (res?.status === "done") {
        toast.success("PDF ready");
        const r = res.result as { pdf_path?: string } | null;
        if (r?.pdf_path) setPdfUrl(await getResumePdfUrl(r.pdf_path));
        load();
      } else if (res?.status === "pending" || res?.status === "running") {
        toast.warning("Worker is busy — compile still queued. PDF will appear once it finishes.");
      } else {
        toast.error(`Compile failed: ${res?.last_error ?? "unknown error"}`);
      }
    } finally {
      setCompiling(false);
    }
  };

  const saveAndCompile = async () => {
    if (!selectedId) return;
    setPdfUrl(null);
    setPreviewMode("template");
    const markers = detectMarkers(editing);
    await supabase.from("resumes").update({ tex_content: editing, markers }).eq("id", selectedId);
    const { triggerCompileResume, waitForCommand, getResumePdfUrl, isWorkerOnline } = await import("@/lib/commands");
    const online = await isWorkerOnline();
    if (!online) {
      await triggerCompileResume(selectedId);
      toast.warning("Worker offline — compile queued. It will run once the worker is back.");
      return;
    }
    setCompiling(true);
    try {
      const cid = await triggerCompileResume(selectedId);
      if (!cid) return;
      const res = await waitForCommand(cid, 60_000);
      if (res?.status === "done") {
        toast.success("PDF updated");
        const r = res.result as { pdf_path?: string } | null;
        if (r?.pdf_path) setPdfUrl(await getResumePdfUrl(r.pdf_path));
        load();
      } else if (res?.status === "pending" || res?.status === "running") {
        toast.warning("Worker is busy — compile still queued. PDF will appear once it finishes.");
      } else {
        toast.error(`Compile failed: ${res?.last_error ?? "unknown error"}`);
      }
    } finally {
      setCompiling(false);
    }
  };

  const generateTailored = async () => {
    if (!topJobId) { toast.error("No jobs yet — scrape one first."); return; }
    setTailoring(true);
    setTailoredUrl(null);
    const { triggerTailor, waitForCommand, getResumePdfUrl } = await import("@/lib/commands");
    const cid = await triggerTailor(topJobId);
    if (!cid) { setTailoring(false); return; }
    const res = await waitForCommand(cid, 180_000);
    setTailoring(false);
    if (res?.status === "done") {
      const r = res.result as { pdf_path?: string; resume_id?: string } | null;
      if (r?.pdf_path) setTailoredUrl(await getResumePdfUrl(r.pdf_path));
      if (r?.resume_id) setTailoredId(r.resume_id);
      setPreviewMode("tailored");
      toast.success("Tailored preview ready");
    } else {
      toast.error(`Tailor failed: ${res?.last_error ?? "timeout"}`);
    }
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("resumes").update({ is_default: false }).eq("user_id", user.id).eq("kind", "template");
    await supabase.from("resumes").update({ is_default: true }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("resumes").delete().eq("id", id);
    if (selectedId === id) setSelectedId(null);
    load();
  };

  const onFile = async (f: File) => { setTex(await f.text()); setName(f.name); };

  const activePdf = previewMode === "tailored" ? tailoredUrl : pdfUrl;
  const selectedTpl = templates.find((t) => t.id === selectedId);

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 lg:h-[calc(100vh-3.5rem)]">
      {/* LEFT — editor / templates / tailor */}
      <div className="space-y-4 lg:overflow-y-auto lg:pr-2">
        <Card>
          <CardHeader>
            <CardTitle>Add a LaTeX template</CardTitle>
            <CardDescription>
              Wrap AI-editable sections in <code>% LOV:summary</code> … <code>% LOV:end</code>. Saving auto-compiles to PDF via tectonic (free, no AI).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="max-w-sm" />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" /><span>Open .tex file</span>
                <input type="file" accept=".tex,text/x-tex,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              <Button onClick={upload} disabled={!tex.trim()}>Save & compile</Button>
            </div>
            {tex && <Textarea rows={8} value={tex} onChange={(e) => setTex(e.target.value)} className="font-mono text-xs" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className={`flex items-center justify-between rounded border p-2 text-sm ${selectedId === t.id ? "border-primary bg-accent/30" : ""}`}>
                <button className="flex-1 text-left" onClick={() => { setSelectedId(t.id); setPreviewMode("template"); }}>
                  <div className="font-medium">
                    {t.name}
                    {t.kind === "synced" && <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">SYNCED</span>}
                    {t.is_default && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">DEFAULT</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{Array.isArray(t.markers) ? t.markers.length : 0} markers · {t.pdf_storage_path ? "PDF ready" : "no PDF"}</div>
                </button>
                <div className="flex gap-1">
                  <DownloadPdfButton resumeId={t.id} name={t.name} />
                  {!t.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(t.id)}>Default</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-center text-xs text-muted-foreground">No templates yet.</p>}
          </CardContent>
        </Card>

        {selectedId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Edit LaTeX</CardTitle>
              <CardDescription>Edit the raw .tex source. Save & recompile to refresh the preview on the right.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={14} value={editing} onChange={(e) => setEditing(e.target.value)} className="font-mono text-xs" />
              <div className="flex justify-end">
                <Button onClick={saveAndCompile} disabled={compiling}>{compiling ? "Compiling…" : "Save & recompile"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tailored preview (top-scored job)</CardTitle>
            <CardDescription>Runs the resume tailor + tectonic compile on the worker. AI tone check before the bot starts applying.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{topJobId ? `Using job ${topJobId.slice(0, 8)}…` : "No jobs scraped yet."}</p>
              <Button size="sm" onClick={generateTailored} disabled={!topJobId || tailoring}>{tailoring ? "Working…" : "Generate preview"}</Button>
            </div>
            {tailoredId && !tailoredUrl && <p className="text-xs text-muted-foreground">Preview generated; PDF loading…</p>}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT — sticky PDF preview */}
      <div className="lg:sticky lg:top-0 lg:h-full">
        <Card className="flex h-full min-h-[60vh] flex-col">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">
                {previewMode === "tailored" ? "Tailored preview" : selectedTpl?.name ?? "PDF preview"}
              </CardTitle>
              <CardDescription className="truncate">
                {previewMode === "tailored"
                  ? "Resume tailored to the top-scored job."
                  : selectedId ? "Compiled template PDF." : "Select a template to preview."}
              </CardDescription>
            </div>
            {tailoredUrl && (
              <div className="flex gap-1">
                <Button size="sm" variant={previewMode === "template" ? "default" : "outline"} onClick={() => setPreviewMode("template")} disabled={!pdfUrl}>Template</Button>
                <Button size="sm" variant={previewMode === "tailored" ? "default" : "outline"} onClick={() => setPreviewMode("tailored")}>Tailored</Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pb-4">
            {activePdf ? (
              <iframe src={activePdf} className="h-full min-h-[60vh] w-full rounded border bg-white" title="Resume PDF" />
            ) : (
              <div className="flex h-full min-h-[60vh] items-center justify-center rounded border text-sm text-muted-foreground">
                {compiling ? "Compiling…" : selectedId ? "No PDF yet — click Save & compile." : "Nothing selected."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

