import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useUser } from "@/lib/useAuth";
import { Plus, Trash2, Upload } from "lucide-react";
import { ResumeStudio } from "@/components/ResumeStudio";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — JobPilot" }] }),
  component: ProfilePage,
});

type Profile = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  timezone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  work_authorization: string | null;
  requires_sponsorship: boolean;
  willing_to_relocate: boolean;
  preferred_locations: string[];
  remote_preference: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  years_experience: number | null;
  headline: string | null;
  summary: string | null;
  cover_letter_tone: string | null;
  apply_email: string | null;
};

function ProfilePage() {
  const { user } = useUser();
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setP(data as Profile);
    });
  }, [user]);

  const save = async () => {
    if (!p || !user) return;
    setSaving(true);
    const { error } = await supabase.from("profile").update({
      ...p,
      preferred_locations: p.preferred_locations ?? [],
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  if (!p) return <div className="text-muted-foreground">Loading…</div>;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">The source of truth for resume tailoring and auto-fill.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="prefs">Preferences</TabsTrigger>
          <TabsTrigger value="experiences">Experiences</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="educations">Education</TabsTrigger>
          <TabsTrigger value="resume">Resume LaTeX</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Full name" value={p.full_name} onChange={(v) => set("full_name", v)} />
            <Field label="Email (display)" value={p.email} onChange={(v) => set("email", v)} />
            <Field label="Phone" value={p.phone} onChange={(v) => set("phone", v)} />
            <Field label="Location" value={p.location} onChange={(v) => set("location", v)} />
            <Field label="Timezone" value={p.timezone} onChange={(v) => set("timezone", v)} />
            <Field label="LinkedIn URL" value={p.linkedin_url} onChange={(v) => set("linkedin_url", v)} />
            <Field label="GitHub URL" value={p.github_url} onChange={(v) => set("github_url", v)} />
            <Field label="Portfolio URL" value={p.portfolio_url} onChange={(v) => set("portfolio_url", v)} />
            <Field label="Headline" value={p.headline} onChange={(v) => set("headline", v)} className="md:col-span-2" />
            <div className="md:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={4} value={p.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="prefs" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Work authorization" value={p.work_authorization} onChange={(v) => set("work_authorization", v)} />
            <Field label="Remote preference (remote/hybrid/onsite/any)" value={p.remote_preference} onChange={(v) => set("remote_preference", v)} />
            <Field label="Salary min" type="number" value={p.salary_min?.toString() ?? ""} onChange={(v) => set("salary_min", v ? Number(v) : null)} />
            <Field label="Salary max" type="number" value={p.salary_max?.toString() ?? ""} onChange={(v) => set("salary_max", v ? Number(v) : null)} />
            <Field label="Currency" value={p.salary_currency} onChange={(v) => set("salary_currency", v)} />
            <Field label="Years experience" type="number" value={p.years_experience?.toString() ?? ""} onChange={(v) => set("years_experience", v ? Number(v) : null)} />
            <Field label="Cover letter tone" value={p.cover_letter_tone} onChange={(v) => set("cover_letter_tone", v)} />
            <Field label="Apply email (for account creation on portals)" value={p.apply_email} onChange={(v) => set("apply_email", v)} />
            <div className="md:col-span-2">
              <Label>Preferred locations (comma-separated)</Label>
              <Input value={(p.preferred_locations ?? []).join(", ")} onChange={(e) => set("preferred_locations", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={p.requires_sponsorship} onCheckedChange={(v) => set("requires_sponsorship", v)} />
              <span className="text-sm">Requires sponsorship</span>
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={p.willing_to_relocate} onCheckedChange={(v) => set("willing_to_relocate", v)} />
              <span className="text-sm">Willing to relocate</span>
            </label>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="experiences"><ListSection table="experiences" /></TabsContent>
        <TabsContent value="projects"><ListSection table="projects" /></TabsContent>
        <TabsContent value="skills"><ListSection table="skills" /></TabsContent>
        <TabsContent value="educations"><ListSection table="educations" /></TabsContent>
        <TabsContent value="resume"><ResumeUploader /></TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, type, className }: { label: string; value: string | null; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const SCHEMAS: Record<string, { fields: { key: string; label: string; type?: string; multi?: boolean }[]; title: string }> = {
  experiences: {
    title: "Experience",
    fields: [
      { key: "company", label: "Company" },
      { key: "title", label: "Title" },
      { key: "location", label: "Location" },
      { key: "start_date", label: "Start (YYYY-MM-DD)", type: "date" },
      { key: "end_date", label: "End (YYYY-MM-DD)", type: "date" },
      { key: "bullets", label: "Bullets (one per line)", multi: true },
      { key: "tech", label: "Tech (comma-separated)", multi: true },
    ],
  },
  projects: {
    title: "Project",
    fields: [
      { key: "name", label: "Name" },
      { key: "url", label: "URL" },
      { key: "description", label: "Description" },
      { key: "bullets", label: "Bullets (one per line)", multi: true },
      { key: "tech", label: "Tech (comma-separated)", multi: true },
    ],
  },
  skills: {
    title: "Skill",
    fields: [
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "proficiency", label: "Proficiency" },
      { key: "years", label: "Years", type: "number" },
    ],
  },
  educations: {
    title: "Education",
    fields: [
      { key: "school", label: "School" },
      { key: "degree", label: "Degree" },
      { key: "field", label: "Field" },
      { key: "start_date", label: "Start", type: "date" },
      { key: "end_date", label: "End", type: "date" },
      { key: "gpa", label: "GPA" },
      { key: "notes", label: "Notes" },
    ],
  },
};

function ListSection({ table }: { table: keyof typeof SCHEMAS }) {
  const { user } = useUser();
  const [items, setItems] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const schema = SCHEMAS[table];

  const db = supabase as unknown as { from: (t: string) => any };
  const load = () => {
    db.from(table).select("*").order("sort_order", { ascending: true }).then(({ data }: { data: Array<Record<string, unknown> & { id: string }> | null }) => setItems(data ?? []));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table]);

  const add = async () => {
    if (!user) return;
    const blank: Record<string, unknown> = { user_id: user.id };
    schema.fields.forEach((f) => { blank[f.key] = f.multi ? [] : ""; });
    if (table === "experiences") { blank.company = "New company"; blank.title = "New title"; }
    if (table === "projects") blank.name = "New project";
    if (table === "skills") blank.name = "New skill";
    if (table === "educations") blank.school = "New school";
    const { error } = await db.from(table).insert(blank);
    if (error) toast.error(error.message); else load();
  };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await db.from(table).update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="space-y-3 pt-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add {schema.title.toLowerCase()}</Button>
      </div>
      {items.map((it) => (
        <Card key={it.id}>
          <CardContent className="grid gap-3 pt-6 md:grid-cols-2">
            {schema.fields.map((f) => {
              const val = it[f.key];
              if (f.multi) {
                const str = Array.isArray(val) ? (f.key === "tech" ? val.join(", ") : val.join("\n")) : "";
                return (
                  <div key={f.key} className="md:col-span-2">
                    <Label>{f.label}</Label>
                    <Textarea rows={4} defaultValue={str} onBlur={(e) => {
                      const arr = f.key === "tech"
                        ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        : e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                      update(it.id, { [f.key]: arr });
                    }} />
                  </div>
                );
              }
              return (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input type={f.type} defaultValue={(val as string | number | null) ?? ""} onBlur={(e) => update(it.id, { [f.key]: f.type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value })} />
                </div>
              );
            })}
            <div className="md:col-span-2 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && <p className="text-center text-sm text-muted-foreground">None yet.</p>}
    </div>
  );
}

function ResumeUploader() {
  const { user } = useUser();
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; tex_content: string | null; is_default: boolean | null; markers: unknown }>>([]);
  const [name, setName] = useState("My LaTeX resume");
  const [tex, setTex] = useState("");

  const load = () => {
    supabase.from("resumes").select("*").eq("kind", "template").order("created_at", { ascending: false }).then(({ data }) => setTemplates(data ?? []));
  };
  useEffect(() => { load(); }, []);

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
    const { error } = await supabase.from("resumes").insert({
      user_id: user.id, kind: "template", name, tex_content: tex,
      markers, is_default: templates.length === 0,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Template saved with ${markers.length} marker(s)`); setTex(""); load(); }
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("resumes").update({ is_default: false }).eq("user_id", user.id).eq("kind", "template");
    await supabase.from("resumes").update({ is_default: true }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("resumes").delete().eq("id", id);
    load();
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    setTex(text);
    setName(f.name);
  };

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload LaTeX template</CardTitle>
          <CardDescription>
            Wrap AI-editable sections in <code>% LOV:summary</code> … <code>% LOV:end</code> markers. The worker only edits inside markers, never the LaTeX itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" className="max-w-sm" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span>Open .tex file</span>
              <input type="file" accept=".tex,text/x-tex,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            <Button onClick={upload} disabled={!tex.trim()}>Save template</Button>
          </div>
          <Textarea rows={12} placeholder="Paste your .tex content here…" value={tex} onChange={(e) => setTex(e.target.value)} className="font-mono text-xs" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <div className="font-medium">{t.name} {t.is_default && <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary">DEFAULT</span>}</div>
                <div className="text-xs text-muted-foreground">{Array.isArray(t.markers) ? t.markers.length : 0} markers</div>
              </div>
              <div className="flex gap-2">
                {!t.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(t.id)}>Make default</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
