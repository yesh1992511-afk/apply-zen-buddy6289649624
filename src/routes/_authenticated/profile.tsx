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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useUser } from "@/lib/useAuth";
import { Plus, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — JobPilot" }] }),
  component: ProfilePage,
});

type Profile = Record<string, unknown> & { user_id: string };

// Fields that count toward "profile complete" for autofill quality.
const CRITICAL_FIELDS: { key: string; label: string }[] = [
  { key: "full_name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "postal_code", label: "Postal code" },
  { key: "street_address", label: "Street address" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "work_auth_country", label: "Work auth country" },
  { key: "visa_status", label: "Visa status" },
  { key: "desired_salary", label: "Desired salary" },
  { key: "notice_period_weeks", label: "Notice period" },
  { key: "headline", label: "Headline" },
  { key: "summary", label: "Summary" },
  { key: "years_experience", label: "Years experience" },
];

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
    // strip read-only / managed columns
    const { user_id: _u, created_at: _c, updated_at: _up, ...patch } = p;
    void _u; void _c; void _up;
    const { error } = await supabase.from("profile").update(patch).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  if (!p) return <div className="text-muted-foreground">Loading…</div>;

  const set = (k: string, v: unknown) => setP({ ...p, [k]: v });
  const get = (k: string) => p[k];
  const getStr = (k: string): string => {
    const v = p[k];
    return v == null ? "" : String(v);
  };
  const getArr = (k: string): string[] => (Array.isArray(p[k]) ? (p[k] as string[]) : []);
  const getBool = (k: string): boolean => Boolean(p[k]);

  const filled = CRITICAL_FIELDS.filter((f) => {
    const v = get(f.key);
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  const completeness = Math.round((filled / CRITICAL_FIELDS.length) * 100);
  const missing = CRITICAL_FIELDS.filter((f) => {
    const v = get(f.key);
    return v === null || v === undefined || String(v).trim() === "";
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">Source of truth for resume tailoring and portal autofill.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Autofill readiness</span>
            <span className="text-muted-foreground">{completeness}%</span>
          </div>
          <Progress value={completeness} />
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Missing: {missing.map((m) => m.label).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="basic">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="address">Address</TabsTrigger>
          <TabsTrigger value="workauth">Work auth</TabsTrigger>
          <TabsTrigger value="comp">Comp & Availability</TabsTrigger>
          <TabsTrigger value="prefs">Preferences</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="experiences">Experience</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="educations">Education</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
          <TabsTrigger value="certifications">Certs</TabsTrigger>
          <TabsTrigger value="references_list">References</TabsTrigger>
          <TabsTrigger value="screening">Screening</TabsTrigger>
          <TabsTrigger value="resume">Resume LaTeX</TabsTrigger>
        </TabsList>

        {/* BASIC */}
        <TabsContent value="basic" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Full name" value={getStr("full_name")} onChange={(v) => set("full_name", v)} />
            <Field label="Preferred name" value={getStr("preferred_name")} onChange={(v) => set("preferred_name", v)} />
            <Field label="Pronouns" value={getStr("pronouns")} onChange={(v) => set("pronouns", v)} />
            <Field label="Date of birth" type="date" value={getStr("date_of_birth")} onChange={(v) => set("date_of_birth", v || null)} />
            <Field label="Email" value={getStr("email")} onChange={(v) => set("email", v)} />
            <Field label="Phone" value={getStr("phone")} onChange={(v) => set("phone", v)} />
            <Field label="Nationality" value={getStr("nationality")} onChange={(v) => set("nationality", v)} />
            <Field label="Timezone" value={getStr("timezone")} onChange={(v) => set("timezone", v)} />
            <Field label="Headline" value={getStr("headline")} onChange={(v) => set("headline", v)} className="md:col-span-2" />
            <div className="md:col-span-2">
              <Label>Summary</Label>
              <Textarea rows={4} value={getStr("summary")} onChange={(e) => set("summary", e.target.value)} />
            </div>
            <Field label="Years experience" type="number" value={getStr("years_experience")} onChange={(v) => set("years_experience", v ? Number(v) : null)} />
            <Field label="Apply email (portal sign-ups)" value={getStr("apply_email")} onChange={(v) => set("apply_email", v)} />
          </CardContent></Card>
        </TabsContent>

        {/* ADDRESS */}
        <TabsContent value="address" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Street address" value={getStr("street_address")} onChange={(v) => set("street_address", v)} className="md:col-span-2" />
            <Field label="Address line 2" value={getStr("address_line_2")} onChange={(v) => set("address_line_2", v)} className="md:col-span-2" />
            <Field label="City" value={getStr("city")} onChange={(v) => set("city", v)} />
            <Field label="State / region" value={getStr("state_region")} onChange={(v) => set("state_region", v)} />
            <Field label="Postal code" value={getStr("postal_code")} onChange={(v) => set("postal_code", v)} />
            <Field label="Country" value={getStr("country")} onChange={(v) => set("country", v)} />
            <Field label="Location (display)" value={getStr("location")} onChange={(v) => set("location", v)} className="md:col-span-2" />
          </CardContent></Card>
        </TabsContent>

        {/* WORK AUTH */}
        <TabsContent value="workauth" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Work authorization</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Field label="Primary work auth country (e.g. US, UK, EU, IN)" value={getStr("work_auth_country")} onChange={(v) => set("work_auth_country", v)} />
              <Field label="Visa status (Citizen, PR, H1B, F1, etc.)" value={getStr("visa_status")} onChange={(v) => set("visa_status", v)} />
              <Field label="Visa expiry" type="date" value={getStr("visa_expiry")} onChange={(v) => set("visa_expiry", v || null)} />
              <Field label="Work authorization (legacy)" value={getStr("work_authorization")} onChange={(v) => set("work_authorization", v)} />
              <div className="md:col-span-2">
                <Label>Other countries you're authorized to work in (comma-separated)</Label>
                <Input value={getArr("authorized_countries").join(", ")} onChange={(e) => set("authorized_countries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
              </div>
              <SwitchRow label="Needs sponsorship now" checked={getBool("needs_visa_now")} onChange={(v) => set("needs_visa_now", v)} />
              <SwitchRow label="Will need sponsorship in the future" checked={getBool("needs_visa_future")} onChange={(v) => set("needs_visa_future", v)} />
              <SwitchRow label="Requires sponsorship (legacy)" checked={getBool("requires_sponsorship")} onChange={(v) => set("requires_sponsorship", v)} />
              <SwitchRow label="Has passport" checked={getBool("has_passport")} onChange={(v) => set("has_passport", v)} />
              <Field label="Passport country" value={getStr("passport_country")} onChange={(v) => set("passport_country", v)} />
              <SwitchRow label="Driver's license" checked={getBool("drivers_license")} onChange={(v) => set("drivers_license", v)} />
              <SwitchRow label="Own transport" checked={getBool("has_own_transport")} onChange={(v) => set("has_own_transport", v)} />
              <Field label="Security clearance (None, Confidential, Secret, TS)" value={getStr("security_clearance")} onChange={(v) => set("security_clearance", v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">EEOC / voluntary demographics</CardTitle>
              <CardDescription>Only auto-filled when the share toggle is on. Stored privately and only used for portals that ask.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <SwitchRow label="Share demographics with portals that ask" checked={getBool("share_demographics")} onChange={(v) => set("share_demographics", v)} />
              </div>
              <Field label="Gender" value={getStr("gender")} onChange={(v) => set("gender", v)} />
              <Field label="Ethnicity" value={getStr("ethnicity")} onChange={(v) => set("ethnicity", v)} />
              <Field label="Veteran status" value={getStr("veteran_status")} onChange={(v) => set("veteran_status", v)} />
              <Field label="Disability status" value={getStr("disability_status")} onChange={(v) => set("disability_status", v)} />
              <Field label="LGBTQ+ status" value={getStr("lgbtq_status")} onChange={(v) => set("lgbtq_status", v)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMP & AVAILABILITY */}
        <TabsContent value="comp" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Desired salary" type="number" value={getStr("desired_salary")} onChange={(v) => set("desired_salary", v ? Number(v) : null)} />
            <Field label="Salary period (yearly / hourly)" value={getStr("salary_period")} onChange={(v) => set("salary_period", v)} />
            <Field label="Current salary" type="number" value={getStr("current_salary")} onChange={(v) => set("current_salary", v ? Number(v) : null)} />
            <Field label="Currency" value={getStr("salary_currency")} onChange={(v) => set("salary_currency", v)} />
            <Field label="Salary min (filter)" type="number" value={getStr("salary_min")} onChange={(v) => set("salary_min", v ? Number(v) : null)} />
            <Field label="Salary max (filter)" type="number" value={getStr("salary_max")} onChange={(v) => set("salary_max", v ? Number(v) : null)} />
            <Field label="Notice period (weeks)" type="number" value={getStr("notice_period_weeks")} onChange={(v) => set("notice_period_weeks", v ? Number(v) : null)} />
            <Field label="Earliest start date" type="date" value={getStr("earliest_start_date")} onChange={(v) => set("earliest_start_date", v || null)} />
            <Field label="Available hours / week" type="number" value={getStr("available_hours_per_week")} onChange={(v) => set("available_hours_per_week", v ? Number(v) : null)} />
            <Field label="Cover letter tone" value={getStr("cover_letter_tone")} onChange={(v) => set("cover_letter_tone", v)} />
            <SwitchRow label="Open to full-time" checked={getBool("open_to_fulltime")} onChange={(v) => set("open_to_fulltime", v)} />
            <SwitchRow label="Open to part-time" checked={getBool("open_to_parttime")} onChange={(v) => set("open_to_parttime", v)} />
            <SwitchRow label="Open to contract" checked={getBool("open_to_contract")} onChange={(v) => set("open_to_contract", v)} />
            <SwitchRow label="Open to internship" checked={getBool("open_to_internship")} onChange={(v) => set("open_to_internship", v)} />
          </CardContent></Card>
        </TabsContent>

        {/* PREFERENCES */}
        <TabsContent value="prefs" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Remote preference (remote / hybrid / onsite / any)" value={getStr("remote_preference")} onChange={(v) => set("remote_preference", v)} />
            <Field label="Travel willingness (0-25%, 25-50%, …)" value={getStr("travel_willingness")} onChange={(v) => set("travel_willingness", v)} />
            <Field label="Shift preference (day / night / flexible)" value={getStr("shift_preference")} onChange={(v) => set("shift_preference", v)} />
            <SwitchRow label="Willing to relocate" checked={getBool("willing_to_relocate")} onChange={(v) => set("willing_to_relocate", v)} />
            <div className="md:col-span-2">
              <Label>Preferred locations (comma-separated)</Label>
              <Input value={getArr("preferred_locations").join(", ")} onChange={(e) => set("preferred_locations", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>
            <div className="md:col-span-2">
              <Label>Desired titles (comma-separated)</Label>
              <Input value={getArr("desired_titles").join(", ")} onChange={(e) => set("desired_titles", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>
            <div className="md:col-span-2">
              <Label>Desired industries</Label>
              <Input value={getArr("desired_industries").join(", ")} onChange={(e) => set("desired_industries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>
            <div className="md:col-span-2">
              <Label>Excluded industries</Label>
              <Input value={getArr("excluded_industries").join(", ")} onChange={(e) => set("excluded_industries", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* LINKS */}
        <TabsContent value="links" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="LinkedIn URL" value={getStr("linkedin_url")} onChange={(v) => set("linkedin_url", v)} />
            <Field label="LinkedIn username" value={getStr("linkedin_username")} onChange={(v) => set("linkedin_username", v)} />
            <Field label="GitHub URL" value={getStr("github_url")} onChange={(v) => set("github_url", v)} />
            <Field label="Portfolio URL" value={getStr("portfolio_url")} onChange={(v) => set("portfolio_url", v)} />
            <Field label="Personal website" value={getStr("personal_website")} onChange={(v) => set("personal_website", v)} />
            <Field label="Twitter / X" value={getStr("twitter_url")} onChange={(v) => set("twitter_url", v)} />
            <Field label="Stack Overflow" value={getStr("stackoverflow_url")} onChange={(v) => set("stackoverflow_url", v)} />
            <Field label="Medium" value={getStr("medium_url")} onChange={(v) => set("medium_url", v)} />
            <Field label="Dribbble" value={getStr("dribbble_url")} onChange={(v) => set("dribbble_url", v)} />
            <Field label="Behance" value={getStr("behance_url")} onChange={(v) => set("behance_url", v)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="experiences"><ListSection table="experiences" /></TabsContent>
        <TabsContent value="projects"><ListSection table="projects" /></TabsContent>
        <TabsContent value="skills"><ListSection table="skills" /></TabsContent>
        <TabsContent value="educations"><ListSection table="educations" /></TabsContent>
        <TabsContent value="languages"><ListSection table="languages" /></TabsContent>
        <TabsContent value="certifications"><ListSection table="certifications" /></TabsContent>
        <TabsContent value="references_list"><ListSection table="references_list" /></TabsContent>

        <TabsContent value="screening"><ScreeningAnswers value={(p.screening_answers as Record<string, string>) ?? {}} onChange={(v) => set("screening_answers", v)} /></TabsContent>

        <TabsContent value="resume"><ResumeUploader /></TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, type, className }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

const SCREENING_PRESETS: { key: string; label: string }[] = [
  { key: "authorized_to_work", label: "Are you legally authorized to work in this country?" },
  { key: "require_sponsorship", label: "Do you now or in the future require sponsorship?" },
  { key: "willing_to_relocate", label: "Are you willing to relocate?" },
  { key: "notice_period", label: "What is your notice period?" },
  { key: "salary_expectation", label: "What is your salary expectation?" },
  { key: "reason_for_leaving", label: "Reason for leaving current role?" },
  { key: "earliest_start", label: "What is your earliest start date?" },
  { key: "remote_preference", label: "What is your remote preference?" },
  { key: "years_experience_role", label: "Years of experience relevant to this role?" },
  { key: "willing_to_travel", label: "How much are you willing to travel?" },
  { key: "highest_education", label: "What is your highest level of education?" },
  { key: "criminal_record", label: "Do you have a criminal record?" },
  { key: "able_to_pass_background_check", label: "Can you pass a background check?" },
  { key: "able_to_pass_drug_test", label: "Can you pass a drug test?" },
  { key: "age_18_plus", label: "Are you 18 years of age or older?" },
];

function ScreeningAnswers({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const [newKey, setNewKey] = useState("");
  const entries = Object.entries(value);

  const update = (k: string, v: string) => onChange({ ...value, [k]: v });
  const remove = (k: string) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };
  const addPreset = (k: string) => {
    if (k in value) return;
    onChange({ ...value, [k]: "" });
  };

  return (
    <div className="space-y-3 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre-answered screening questions</CardTitle>
          <CardDescription>The autofill bot fuzzy-matches portal questions to these keys. Click a preset to add it, then type your answer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SCREENING_PRESETS.map((p) => (
              <Button key={p.key} size="sm" variant="outline" onClick={() => addPreset(p.key)} disabled={p.key in value}>
                + {p.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="custom_key (snake_case)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <Button onClick={() => { if (newKey.trim()) { addPreset(newKey.trim()); setNewKey(""); } }}>Add</Button>
          </div>
        </CardContent>
      </Card>
      {entries.length === 0 && <p className="text-center text-sm text-muted-foreground">No screening answers yet.</p>}
      {entries.map(([k, v]) => {
        const preset = SCREENING_PRESETS.find((p) => p.key === k);
        return (
          <Card key={k}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{preset?.label ?? k}</Label>
                <Button size="sm" variant="ghost" onClick={() => remove(k)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">key: <code>{k}</code></p>
              <Textarea rows={2} value={v} onChange={(e) => update(k, e.target.value)} />
            </CardContent>
          </Card>
        );
      })}
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
  languages: {
    title: "Language",
    fields: [
      { key: "name", label: "Language" },
      { key: "proficiency", label: "Proficiency (Native, Fluent, Conversational, Basic)" },
    ],
  },
  certifications: {
    title: "Certification",
    fields: [
      { key: "name", label: "Name" },
      { key: "issuer", label: "Issuer" },
      { key: "issued_date", label: "Issued", type: "date" },
      { key: "expiry_date", label: "Expiry", type: "date" },
      { key: "credential_id", label: "Credential ID" },
      { key: "url", label: "URL" },
    ],
  },
  references_list: {
    title: "Reference",
    fields: [
      { key: "name", label: "Name" },
      { key: "relationship", label: "Relationship" },
      { key: "company", label: "Company" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
  },
};

function ListSection({ table }: { table: keyof typeof SCHEMAS }) {
  const { user } = useUser();
  const [items, setItems] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const schema = SCHEMAS[table];

  const db = supabase as unknown as { from: (t: string) => any };
  const load = () => {
    const q = db.from(table).select("*");
    const ordered = (table === "languages" || table === "certifications" || table === "references_list")
      ? q.order("created_at", { ascending: true })
      : q.order("sort_order", { ascending: true });
    ordered.then(({ data }: { data: Array<Record<string, unknown> & { id: string }> | null }) => setItems(data ?? []));
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
    if (table === "languages") blank.name = "English";
    if (table === "certifications") blank.name = "New certification";
    if (table === "references_list") blank.name = "New reference";
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
  type Tpl = { id: string; name: string; tex_content: string | null; is_default: boolean | null; markers: unknown; pdf_storage_path: string | null; kind: string };
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

  const load = () => {
    supabase.from("resumes").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      const all = (data ?? []) as Tpl[];
      setTemplates(all.filter((r) => r.kind === "template"));
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
    toast.success(`Template saved (${markers.length} markers). Compiling…`);
    setTex("");
    load();
    const { triggerCompileResume, waitForCommand, getResumePdfUrl } = await import("@/lib/commands");
    const cid = await triggerCompileResume(data.id);
    if (cid) {
      const res = await waitForCommand(cid, 60_000);
      if (res?.status === "done") {
        toast.success("PDF ready");
        const r = res.result as { pdf_path?: string } | null;
        if (r?.pdf_path) setPdfUrl(await getResumePdfUrl(r.pdf_path));
        setSelectedId(data.id);
        load();
      } else {
        toast.error(`Compile failed: ${res?.last_error ?? "timeout"}`);
      }
    }
  };

  const saveAndCompile = async () => {
    if (!selectedId) return;
    setCompiling(true);
    setPdfUrl(null);
    const markers = detectMarkers(editing);
    await supabase.from("resumes").update({ tex_content: editing, markers }).eq("id", selectedId);
    const { triggerCompileResume, waitForCommand, getResumePdfUrl } = await import("@/lib/commands");
    const cid = await triggerCompileResume(selectedId);
    if (!cid) { setCompiling(false); return; }
    const res = await waitForCommand(cid, 60_000);
    setCompiling(false);
    if (res?.status === "done") {
      toast.success("PDF updated");
      const r = res.result as { pdf_path?: string } | null;
      if (r?.pdf_path) setPdfUrl(await getResumePdfUrl(r.pdf_path));
      load();
    } else {
      toast.error(`Compile failed: ${res?.last_error ?? "timeout"}`);
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

  return (
    <div className="space-y-4 pt-4">
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

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Templates</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className={`flex items-center justify-between rounded border p-2 text-sm ${selectedId === t.id ? "border-primary bg-accent/30" : ""}`}>
                <button className="flex-1 text-left" onClick={() => setSelectedId(t.id)}>
                  <div className="font-medium">{t.name}{t.is_default && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">DEFAULT</span>}</div>
                  <div className="text-xs text-muted-foreground">{Array.isArray(t.markers) ? t.markers.length : 0} markers · {t.pdf_storage_path ? "PDF ready" : "no PDF"}</div>
                </button>
                <div className="flex gap-1">
                  {!t.is_default && <Button size="sm" variant="outline" onClick={() => setDefault(t.id)}>Default</Button>}
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <p className="text-center text-xs text-muted-foreground">No templates yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">PDF preview</CardTitle>
            <CardDescription>{selectedId ? "Edit LaTeX below and recompile." : "Select a template to preview."}</CardDescription>
          </CardHeader>
          <CardContent>
            {pdfUrl ? (
              <iframe src={pdfUrl} className="h-[420px] w-full rounded border bg-white" title="Resume PDF" />
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded border text-sm text-muted-foreground">
                {compiling ? "Compiling…" : selectedId ? "No PDF yet — click Save & compile." : "Nothing selected."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Edit LaTeX (background)</CardTitle>
            <CardDescription>The frontend only shows the PDF. Edit the raw .tex here when you need to tweak the template.</CardDescription>
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
          {tailoredUrl && <iframe src={tailoredUrl} className="h-[480px] w-full rounded border bg-white" title="Tailored resume" />}
          {tailoredId && !tailoredUrl && <p className="text-xs text-muted-foreground">Preview generated; PDF loading…</p>}
        </CardContent>
      </Card>
    </div>
  );
}
