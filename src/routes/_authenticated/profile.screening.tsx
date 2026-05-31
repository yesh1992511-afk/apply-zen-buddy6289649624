import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile/screening")({
  head: () => ({ meta: [{ title: "Screening answers — JobPilot" }] }),
  component: ScreeningAnswersPage,
});

type Answers = Record<string, string>;

function ScreeningAnswersPage() {
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profile")
        .select("screening_answers")
        .eq("user_id", uid)
        .maybeSingle();
      const sa = (data?.screening_answers as Answers | null) ?? {};
      setAnswers(sa);
      setLoading(false);
    })();
  }, []);

  async function save(next: Answers) {
    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    const { error } = await supabase
      .from("profile")
      .update({ screening_answers: next })
      .eq("user_id", uid);
    setSaving(false);
    if (error) {
      toast.error("Failed to save");
      return;
    }
    setAnswers(next);
    toast.success("Saved");
  }

  function updateAnswer(key: string, val: string) {
    setAnswers({ ...answers, [key]: val });
  }

  function removeAnswer(key: string) {
    const next = { ...answers };
    delete next[key];
    save(next);
  }

  function addAnswer() {
    if (!newKey.trim() || !newVal.trim()) return;
    const next = { ...answers, [newKey.trim().toLowerCase()]: newVal.trim() };
    save(next);
    setNewKey("");
    setNewVal("");
  }

  const entries = Object.entries(answers).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to="/profile"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Back to profile</Link>
        </Button>
        <h1 className="font-heading text-xl font-bold">Screening answers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cached answers to ATS screening questions. The autopilot fills these automatically and adds new ones (marked <Sparkles className="inline h-3 w-3 text-accent-foreground" /> AI) when it encounters a question without a saved answer.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add a new answer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Question key (e.g. why this company)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Textarea placeholder="Your answer" value={newVal} onChange={(e) => setNewVal(e.target.value)} rows={3} />
          <Button onClick={addAnswer} disabled={!newKey.trim() || !newVal.trim() || saving} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add answer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {loading ? "Loading…" : `${entries.length} saved answer${entries.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground italic">No cached answers yet. They'll appear here as the autopilot encounters screening questions.</p>
          )}
          {entries.map(([key, val]) => (
            <div key={key} className="space-y-1.5 pb-4 border-b border-border/40 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex-1">{key}</div>
                <Button variant="ghost" size="sm" onClick={() => removeAnswer(key)} className="h-7 px-2 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={val}
                onChange={(e) => updateAnswer(key, e.target.value)}
                onBlur={() => save(answers)}
                rows={3}
                className="text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
