import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCoverLetters,
  upsertCoverLetter,
  deleteCoverLetter,
  setDefaultCoverLetter,
  generateCoverLetterForJob,
  type CoverLetterRow,
} from "@/lib/coverLetters.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Mail, Plus, Trash2, Star, Sparkles, Loader2, FileText, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";

export const Route = createFileRoute("/_authenticated/cover-letters")({
  head: () => ({ meta: [{ title: "Cover letters — JobPilot" }] }),
  component: CoverLettersPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

const DEFAULT_TEMPLATE = `Dear Hiring Manager,

I'm excited to apply for the {ROLE} role at {COMPANY}. With {YEARS} years of experience shipping production systems, I bring deep expertise in the exact areas your team is investing in.

In my most recent role I [SPECIFIC OUTCOME]. That work mapped directly to what {COMPANY} is building, and I'm ready to bring the same focus to your team.

I'd welcome the chance to talk through how I can help. Available for a conversation any time this week.

Best,
{NAME}`;

function CoverLettersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCoverLetters);
  const upsertFn = useServerFn(upsertCoverLetter);
  const deleteFn = useServerFn(deleteCoverLetter);
  const setDefaultFn = useServerFn(setDefaultCoverLetter);
  const generateFn = useServerFn(generateCoverLetterForJob);

  const lettersQ = useQuery({ queryKey: ["cover_letters"], queryFn: () => listFn() });
  const letters = lettersQ.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState("professional");
  const [isDefault, setIsDefault] = useState(false);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; company: string }>>([]);
  const [pickedJob, setPickedJob] = useState<string>("");

  // Pre-fill template if no letters yet
  useEffect(() => {
    if (!lettersQ.isFetched) return;
    if (letters.length === 0 && !selectedId) {
      setName("Default template");
      setBody(DEFAULT_TEMPLATE);
      setIsDefault(true);
    }
  }, [lettersQ.isFetched, letters.length, selectedId]);

  // Load matched jobs for the generator
  useEffect(() => {
    supabase
      .from("jobs")
      .select("id,title,company")
      .eq("matched", true)
      .order("score", { ascending: false })
      .limit(50)
      .then(({ data }) => setJobs((data ?? []) as typeof jobs));
  }, []);

  const selected = useMemo(() => letters.find((l) => l.id === selectedId) ?? null, [letters, selectedId]);

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setBody(selected.body);
      setTone(selected.tone ?? "professional");
      setIsDefault(selected.is_default);
    }
  }, [selected]);

  const saveMut = useMutation({
    mutationFn: async () => {
      return upsertFn({ data: { id: selectedId ?? undefined, name, body, tone, is_default: isDefault } });
    },
    onSuccess: (r) => {
      toast.success(selectedId ? "Cover letter updated" : "Cover letter saved");
      setSelectedId(r.id);
      qc.invalidateQueries({ queryKey: ["cover_letters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      setSelectedId(null);
      setName("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["cover_letters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefMut = useMutation({
    mutationFn: async (id: string) => setDefaultFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Set as default");
      qc.invalidateQueries({ queryKey: ["cover_letters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const genMut = useMutation({
    mutationFn: async () => generateFn({ data: { jobId: pickedJob, tone, save: true } }),
    onSuccess: (r) => {
      toast.success("Cover letter generated");
      setBody(r.body);
      if (r.id) setSelectedId(r.id);
      qc.invalidateQueries({ queryKey: ["cover_letters"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        icon={Mail}
        title="Cover letters"
        description="Templates and AI-generated letters per job. The default template is sent when a portal asks for a cover letter and no per-job letter has been generated."
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left rail — list */}
        <aside className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => {
              setSelectedId(null);
              setName("New template");
              setBody(DEFAULT_TEMPLATE);
              setTone("professional");
              setIsDefault(false);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New template
          </Button>
          {lettersQ.isLoading ? (
            <div className="rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
              Loading…
            </div>
          ) : letters.length === 0 ? (
            <EmptyState title="No cover letters yet" description="Start with the default template on the right." />
          ) : (
            <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
              {letters.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 transition-colors",
                    selectedId === l.id ? "bg-primary/10" : "hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{l.name}</span>
                    {l.is_default && <Star className="h-3 w-3 text-warning fill-warning shrink-0" />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">
                      {l.kind}
                    </Badge>
                    <span>{timeAgo(l.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Right pane — editor + AI generator */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{selectedId ? "Edit cover letter" : "New cover letter"}</CardTitle>
                  <CardDescription>
                    Use placeholders like <code className="text-xs">&#123;ROLE&#125;</code>, <code className="text-xs">&#123;COMPANY&#125;</code>, <code className="text-xs">&#123;NAME&#125;</code>, <code className="text-xs">&#123;YEARS&#125;</code> — the worker fills them at apply-time.
                  </CardDescription>
                </div>
                {selected && (
                  <div className="flex items-center gap-1.5">
                    {!selected.is_default && (
                      <Button size="sm" variant="outline" onClick={() => setDefMut.mutate(selected.id)} disabled={setDefMut.isPending}>
                        <Star className="h-3.5 w-3.5 mr-1.5" />Set default
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => delMut.mutate(selected.id)} disabled={delMut.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="cl-name">Name</Label>
                  <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Default template" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                    Default
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cl-body">Body</Label>
                <Textarea
                  id="cl-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={18}
                  className="font-mono text-sm leading-relaxed"
                />
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {body.length} chars · ~{Math.round(body.split(/\s+/).filter(Boolean).length)} words
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name || !body}>
                  {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                  {selectedId ? "Save changes" : "Create template"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(body);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI generator */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Generate per-job with AI
              </CardTitle>
              <CardDescription>
                Pulls your profile + the job description and writes a tailored letter using Lovable AI. Saved as a new "generated" letter you can edit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Select value={pickedJob} onValueChange={setPickedJob}>
                  <SelectTrigger>
                    <SelectValue placeholder={jobs.length ? "Pick a matched job" : "No matched jobs — adjust filters first"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.company} — {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => genMut.mutate()} disabled={!pickedJob || genMut.isPending} className="gap-1.5">
                  {genMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {genMut.isPending ? "Writing…" : "Generate"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Generation usually takes 10–20 seconds. The result populates the editor above so you can review before it's sent.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
