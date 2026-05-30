/**
 * Resume Studio — LaTeX lives in the DB and is edited in the background,
 * the user only ever sees a compiled PDF (via tectonic on the worker).
 *
 * Tabs:
 *   • Templates: list resumes, edit .tex, recompile, see PDF preview
 *   • Upload .tex: drag/paste a template, auto-compile
 *   • Tailored: render the highest-score job's tailored PDF
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Upload, RefreshCw, Trash2, Code2, Wand2 } from "lucide-react";
import {
  triggerCompileResume,
  triggerTailor,
  waitForCommand,
  getResumePdfUrl,
} from "@/lib/commands";

type Resume = {
  id: string;
  name: string;
  kind: string;
  tex_content: string | null;
  pdf_storage_path: string | null;
  is_default: boolean | null;
  markers: unknown;
  created_at: string;
};

function PdfPreview({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(null); return; }
    getResumePdfUrl(path).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [path]);
  if (!path) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No PDF yet — click "Compile" to generate one.
      </div>
    );
  }
  if (!url) return <div className="flex h-[600px] items-center justify-center rounded-md border text-sm">Loading…</div>;
  return (
    <object data={url} type="application/pdf" className="h-[600px] w-full rounded-md border">
      <a href={url} target="_blank" rel="noreferrer" className="underline">Open PDF</a>
    </object>
  );
}

function detectMarkers(s: string): string[] {
  const re = /%\s*LOV:([a-zA-Z0-9_:.-]+)/g;
  const out: string[] = [];
  let m;
  while ((m = re.exec(s))) if (m[1] !== "end") out.push(m[1]);
  return [...new Set(out)];
}

function TemplatesPanel() {
  const { user } = useUser();
  const [items, setItems] = useState<Resume[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tex, setTex] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = () => {
    supabase.from("resumes").select("*").eq("kind", "template").order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Resume[];
        setItems(list);
        if (!selectedId && list[0]) setSelectedId(list[0].id);
      });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const selected = useMemo(() => items.find((r) => r.id === selectedId) ?? null, [items, selectedId]);
  useEffect(() => { setTex(selected?.tex_content ?? ""); }, [selected?.id, selected?.tex_content]);

  const compile = async (id: string, newTex?: string) => {
    if (newTex !== undefined) {
      const { error } = await supabase.from("resumes").update({
        tex_content: newTex, markers: detectMarkers(newTex),
      }).eq("id", id);
      if (error) { toast.error(error.message); return; }
    }
    setCompiling(true);
    const cid = await triggerCompileResume(id);
    if (!cid) { setCompiling(false); return; }
    const final = await waitForCommand(cid, 90_000);
    setCompiling(false);
    if (!final) { toast.error("Compile timed out. Check that the worker is online."); return; }
    if (final.status === "failed") { toast.error(final.last_error || "Compile failed"); return; }
    toast.success("PDF compiled");
    load();
    setReloadKey((k) => k + 1);
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

  if (items.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        No templates yet. Use the "Upload .tex" tab to add one.
      </CardContent></Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`w-full rounded-md border p-3 text-left text-sm transition hover:bg-accent ${selectedId === t.id ? "border-primary bg-accent" : ""}`}
          >
            <div className="flex items-center gap-2 font-medium">
              <FileText className="h-4 w-4" /> {t.name}
              {t.is_default && <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">DEFAULT</span>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {Array.isArray(t.markers) ? t.markers.length : 0} markers · {t.pdf_storage_path ? "PDF ready" : "no PDF"}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">{selected.name}</CardTitle>
              <CardDescription>LaTeX is edited in the background — preview is always a PDF.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowCode((v) => !v)}>
                <Code2 className="mr-1 h-3 w-3" /> {showCode ? "Hide" : "Edit"} LaTeX
              </Button>
              <Button size="sm" onClick={() => compile(selected.id, showCode ? tex : undefined)} disabled={compiling}>
                <RefreshCw className={`mr-1 h-3 w-3 ${compiling ? "animate-spin" : ""}`} />
                {compiling ? "Compiling…" : "Compile"}
              </Button>
              {!selected.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(selected.id)}>Make default</Button>}
              <Button size="sm" variant="ghost" onClick={() => remove(selected.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showCode && (
              <Textarea
                rows={14}
                value={tex}
                onChange={(e) => setTex(e.target.value)}
                className="font-mono text-xs"
                placeholder="\\documentclass{article}…"
              />
            )}
            <PdfPreview key={reloadKey} path={selected.pdf_storage_path} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UploadPanel({ onSaved }: { onSaved: () => void }) {
  const { user } = useUser();
  const [name, setName] = useState("My LaTeX resume");
  const [tex, setTex] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    const text = await f.text();
    setTex(text);
    setName(f.name.replace(/\.tex$/i, ""));
  };

  const save = async () => {
    if (!user || !tex.trim()) return;
    setBusy(true);
    const markers = detectMarkers(tex);
    const { data, error } = await supabase.from("resumes").insert({
      user_id: user.id, kind: "template", name, tex_content: tex,
      markers, is_default: false,
    }).select("id").single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success(`Template saved (${markers.length} markers). Compiling…`);
    const cid = await triggerCompileResume(data.id);
    if (cid) await waitForCommand(cid, 90_000);
    setBusy(false);
    setTex("");
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload LaTeX template</CardTitle>
        <CardDescription>
          Wrap AI-editable sections in <code>% LOV:summary</code> … <code>% LOV:end</code> markers.
          The worker only edits inside markers — never the LaTeX scaffolding itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="max-w-sm" />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> Open .tex file
            <input type="file" accept=".tex,text/x-tex,text/plain" className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <Button onClick={save} disabled={!tex.trim() || busy}>{busy ? "Saving…" : "Save & compile"}</Button>
        </div>
        <Textarea rows={12} placeholder="Paste your .tex content here…"
          value={tex} onChange={(e) => setTex(e.target.value)} className="font-mono text-xs" />
      </CardContent>
    </Card>
  );
}

function TailoredPanel() {
  const [topJob, setTopJob] = useState<{ id: string; title: string; company: string; score: number | null } | null>(null);
  const [preview, setPreview] = useState<Resume | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("jobs").select("id,title,company,score").order("score", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setTopJob(data as never));
    supabase.from("resumes").select("*").eq("kind", "tailored").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPreview(data as Resume | null));
  }, []);

  const generate = async () => {
    if (!topJob) { toast.error("No jobs in DB yet — scrape some first."); return; }
    setBusy(true);
    const cid = await triggerTailor(topJob.id);
    if (!cid) { setBusy(false); return; }
    const final = await waitForCommand(cid, 180_000);
    setBusy(false);
    if (!final || final.status !== "done") { toast.error(final?.last_error || "Tailor failed"); return; }
    toast.success("Tailored PDF ready");
    const { data } = await supabase.from("resumes").select("*").eq("kind", "tailored")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setPreview(data as Resume | null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tailored preview</CardTitle>
        <CardDescription>
          Generates a tailored resume for your highest-scoring job. Uses your default template + AI to fill markers,
          then compiles to PDF on the worker. Sanity-check tone before the bot starts applying.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <div>
            {topJob ? <>Top job: <span className="font-medium">{topJob.title}</span> @ {topJob.company} <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">score {topJob.score}</span></> : "No jobs available yet."}
          </div>
          <Button size="sm" onClick={generate} disabled={!topJob || busy}>
            <Wand2 className={`mr-1 h-3 w-3 ${busy ? "animate-pulse" : ""}`} />
            {busy ? "Generating…" : "Generate preview"}
          </Button>
        </div>
        <PdfPreview path={preview?.pdf_storage_path ?? null} />
      </CardContent>
    </Card>
  );
}

export function ResumeStudio() {
  const [k, setK] = useState(0);
  return (
    <Tabs defaultValue="templates" className="pt-4">
      <TabsList>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="upload">Upload .tex</TabsTrigger>
        <TabsTrigger value="tailored">Tailored preview</TabsTrigger>
      </TabsList>
      <TabsContent value="templates"><TemplatesPanel key={k} /></TabsContent>
      <TabsContent value="upload"><UploadPanel onSaved={() => setK((x) => x + 1)} /></TabsContent>
      <TabsContent value="tailored"><TailoredPanel /></TabsContent>
    </Tabs>
  );
}
