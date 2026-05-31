import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfileEditor } from "@/lib/queries/profile";
import { SavedIndicator } from "@/components/SavedIndicator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/DatePickerField";
import {
  COUNTRIES, US_STATES, US_METROS, WORK_AUTH_US,
  GENDER, PRONOUNS, ETHNICITY_EEOC, VETERAN_STATUS, DISABILITY_STATUS, LGBTQ_STATUS,
  REMOTE_PREFERENCE, INDUSTRIES, SALARY_PERIOD, CURRENCIES,
  NOTICE_PERIOD_WEEKS, TRAVEL_WILLINGNESS, SHIFT_PREFERENCE, SECURITY_CLEARANCE,
  PROFICIENCY_LANGUAGE, PROFICIENCY_SKILL, DEGREE, COVER_LETTER_TONE, SCREENING_OPTIONS,
} from "@/lib/profile-options";


import { toast } from "sonner";
import { useUser } from "@/lib/useAuth";
import { Plus, Trash2, Upload, X } from "lucide-react";


export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — JobPilot" }] }),
  component: ProfilePage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});



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
  const { data: p, set, flush, saveState, error: saveError, isLoading } = useProfileEditor();
  const [tab, setTab] = useState<string>(() =>
    typeof window !== "undefined" && window.location.hash.length > 1 ? window.location.hash.slice(1) : "basic",
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    history.replaceState(null, "", `#${tab}`);
  }, [tab]);


  // Hint that `user` is still consumed elsewhere (kept for future per-section flushes).
  void user;

  if (isLoading || !p) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-md bg-surface-2" />
        <div className="h-20 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-96 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

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
    <div className="space-y-6 max-w-[1400px]" onBlurCapture={() => flush()}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Source of truth for resume tailoring and portal autofill. Changes save automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SavedIndicator state={saveState} error={saveError} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => flush()}
            disabled={saveState !== "dirty"}
          >
            Save now
          </Button>
        </div>
      </div>

      {/* Readiness band */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full font-heading text-lg font-bold tabular-nums ${
              completeness >= 90 ? "bg-gradient-gold text-gold-foreground" : completeness >= 60 ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
            }`}>
              {completeness}
            </div>
            <div>
              <div className="font-heading text-sm font-semibold">Autofill readiness</div>
              <p className="text-xs text-muted-foreground">
                {filled} of {CRITICAL_FIELDS.length} critical fields filled
                {completeness === 100 && " · ready for full autopilot"}
              </p>
            </div>
          </div>
          <div className="hidden flex-1 max-w-xs sm:block">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full transition-all duration-500 ${completeness >= 90 ? "bg-gradient-gold" : "bg-gradient-emerald"}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        </div>
        {missing.length > 0 && (
          <div className="border-t border-border/40 bg-surface-1 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Missing:</span>{" "}
              {missing.map((m) => m.label).join(" · ")}
            </p>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>


        <TabsList className="flex h-auto flex-wrap gap-1 bg-surface-1 p-1">
          <TabsTrigger value="basic" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Basic</TabsTrigger>
          <TabsTrigger value="address" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Address</TabsTrigger>
          <TabsTrigger value="workauth" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Work auth</TabsTrigger>
          <TabsTrigger value="comp" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Comp</TabsTrigger>
          <TabsTrigger value="prefs" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Preferences</TabsTrigger>
          <TabsTrigger value="links" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Links</TabsTrigger>
          <TabsTrigger value="experiences" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Experience</TabsTrigger>
          <TabsTrigger value="projects" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Projects</TabsTrigger>
          <TabsTrigger value="skills" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Skills</TabsTrigger>
          <TabsTrigger value="educations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Education</TabsTrigger>
          <TabsTrigger value="languages" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Languages</TabsTrigger>
          <TabsTrigger value="certifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Certs</TabsTrigger>
          <TabsTrigger value="references_list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">References</TabsTrigger>
          <TabsTrigger value="screening" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Screening</TabsTrigger>
          
        </TabsList>

        {/* BASIC */}
        <TabsContent value="basic" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Full name" value={getStr("full_name")} onChange={(v) => set("full_name", v)} />
            <Field label="Preferred name" value={getStr("preferred_name")} onChange={(v) => set("preferred_name", v)} />
            <SelectField label="Pronouns" value={getStr("pronouns")} onChange={(v) => set("pronouns", v)} options={PRONOUNS} />
            <DatePickerField label="Date of birth" value={getStr("date_of_birth")} onChange={(v) => set("date_of_birth", v)} endMonth={new Date()} disabled={(d) => d > new Date()} />
            <Field label="Email" value={getStr("email")} onChange={(v) => set("email", v)} />
            <Field label="Phone" value={getStr("phone")} onChange={(v) => set("phone", v)} />
            <SelectField label="Nationality" value={getStr("nationality")} onChange={(v) => set("nationality", v)} options={COUNTRIES} />
            <Field label="Timezone (e.g. America/New_York)" value={getStr("timezone")} onChange={(v) => set("timezone", v)} />
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
            <SelectField label="City (US metro)" value={getStr("city")} onChange={(v) => set("city", v)} options={US_METROS} allowCustom />
            <SelectField label="State" value={getStr("state_region")} onChange={(v) => set("state_region", v)} options={US_STATES} />
            <Field label="ZIP / Postal code" value={getStr("postal_code")} onChange={(v) => set("postal_code", v)} />
            <SelectField label="Country" value={getStr("country") || "United States"} onChange={(v) => set("country", v)} options={COUNTRIES} />
            <Field label="Display location (e.g. New York, NY)" value={getStr("location")} onChange={(v) => set("location", v)} className="md:col-span-2" />
          </CardContent></Card>
        </TabsContent>

        {/* WORK AUTH */}
        <TabsContent value="workauth" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">U.S. work authorization</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <SelectField label="Work auth country" value={getStr("work_auth_country") || "United States"} onChange={(v) => set("work_auth_country", v)} options={COUNTRIES} />
              <SelectField label="Visa / work auth status" value={getStr("visa_status")} onChange={(v) => { set("visa_status", v); set("work_authorization", v); }} options={WORK_AUTH_US} />
              <DatePickerField label="Visa expiry (if applicable)" value={getStr("visa_expiry")} onChange={(v) => set("visa_expiry", v)} />
              <SelectField label="Do you require sponsorship NOW?" value={getBool("needs_visa_now") ? "Yes" : "No"} onChange={(v) => set("needs_visa_now", v === "Yes")} options={["Yes", "No"]} />
              <SelectField label="Will you require sponsorship in the FUTURE?" value={getBool("needs_visa_future") ? "Yes" : "No"} onChange={(v) => { set("needs_visa_future", v === "Yes"); set("requires_sponsorship", v === "Yes"); }} options={["Yes", "No"]} />
              <MultiSelectChips label="Other countries authorized to work in" values={getArr("authorized_countries")} onChange={(arr) => set("authorized_countries", arr)} options={COUNTRIES} className="md:col-span-2" />
              <SelectField label="Has passport" value={getBool("has_passport") ? "Yes" : "No"} onChange={(v) => set("has_passport", v === "Yes")} options={["Yes", "No"]} />
              <SelectField label="Passport country" value={getStr("passport_country")} onChange={(v) => set("passport_country", v)} options={COUNTRIES} />
              <SelectField label="Driver's license" value={getBool("drivers_license") ? "Yes" : "No"} onChange={(v) => set("drivers_license", v === "Yes")} options={["Yes", "No"]} />
              <SelectField label="Own reliable transportation" value={getBool("has_own_transport") ? "Yes" : "No"} onChange={(v) => set("has_own_transport", v === "Yes")} options={["Yes", "No"]} />
              <SelectField label="Security clearance" value={getStr("security_clearance")} onChange={(v) => set("security_clearance", v)} options={SECURITY_CLEARANCE} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">EEOC / voluntary self-identification</CardTitle>
              <CardDescription>Standard U.S. employer self-ID. Only auto-filled when the share toggle is on.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <SwitchRow label="Share demographics with portals that ask" checked={getBool("share_demographics")} onChange={(v) => set("share_demographics", v)} />
              </div>
              <SelectField label="Gender" value={getStr("gender")} onChange={(v) => set("gender", v)} options={GENDER} />
              <SelectField label="Race / ethnicity" value={getStr("ethnicity")} onChange={(v) => set("ethnicity", v)} options={ETHNICITY_EEOC} />
              <SelectField label="Veteran status" value={getStr("veteran_status")} onChange={(v) => set("veteran_status", v)} options={VETERAN_STATUS} />
              <SelectField label="Disability status" value={getStr("disability_status")} onChange={(v) => set("disability_status", v)} options={DISABILITY_STATUS} />
              <SelectField label="LGBTQ+ status" value={getStr("lgbtq_status")} onChange={(v) => set("lgbtq_status", v)} options={LGBTQ_STATUS} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMP & AVAILABILITY */}
        <TabsContent value="comp" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Field label="Desired salary" type="number" value={getStr("desired_salary")} onChange={(v) => set("desired_salary", v ? Number(v) : null)} />
            <SelectFieldKV label="Salary period" value={getStr("salary_period") || "yearly"} onChange={(v) => set("salary_period", v)} options={SALARY_PERIOD} />
            <Field label="Current salary" type="number" value={getStr("current_salary")} onChange={(v) => set("current_salary", v ? Number(v) : null)} />
            <SelectField label="Currency" value={getStr("salary_currency") || "USD"} onChange={(v) => set("salary_currency", v)} options={CURRENCIES} />
            <Field label="Salary min (filter)" type="number" value={getStr("salary_min")} onChange={(v) => set("salary_min", v ? Number(v) : null)} />
            <Field label="Salary max (filter)" type="number" value={getStr("salary_max")} onChange={(v) => set("salary_max", v ? Number(v) : null)} />
            <SelectFieldKV label="Notice period" value={getStr("notice_period_weeks")} onChange={(v) => set("notice_period_weeks", v ? Number(v) : null)} options={NOTICE_PERIOD_WEEKS.map((o) => ({ value: String(o.value), label: o.label }))} />
            <DatePickerField label="Earliest start date" value={getStr("earliest_start_date")} onChange={(v) => set("earliest_start_date", v)} startMonth={new Date()} />
            <Field label="Available hours / week" type="number" value={getStr("available_hours_per_week")} onChange={(v) => set("available_hours_per_week", v ? Number(v) : null)} />
            <SelectFieldKV label="Cover letter tone" value={getStr("cover_letter_tone") || "professional"} onChange={(v) => set("cover_letter_tone", v)} options={COVER_LETTER_TONE} />
            <SwitchRow label="Open to full-time" checked={getBool("open_to_fulltime")} onChange={(v) => set("open_to_fulltime", v)} />
            <SwitchRow label="Open to part-time" checked={getBool("open_to_parttime")} onChange={(v) => set("open_to_parttime", v)} />
            <SwitchRow label="Open to contract" checked={getBool("open_to_contract")} onChange={(v) => set("open_to_contract", v)} />
            <SwitchRow label="Open to internship" checked={getBool("open_to_internship")} onChange={(v) => set("open_to_internship", v)} />
          </CardContent></Card>
        </TabsContent>

        {/* PREFERENCES */}
        <TabsContent value="prefs" className="space-y-4 pt-4">
          <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <SelectFieldKV label="Remote preference" value={getStr("remote_preference") || "any"} onChange={(v) => set("remote_preference", v)} options={REMOTE_PREFERENCE} />
            <SelectField label="Travel willingness" value={getStr("travel_willingness")} onChange={(v) => set("travel_willingness", v)} options={TRAVEL_WILLINGNESS} />
            <SelectField label="Shift preference" value={getStr("shift_preference")} onChange={(v) => set("shift_preference", v)} options={SHIFT_PREFERENCE} />
            <SwitchRow label="Willing to relocate" checked={getBool("willing_to_relocate")} onChange={(v) => set("willing_to_relocate", v)} />
            <MultiSelectChips label="Preferred locations" values={getArr("preferred_locations")} onChange={(arr) => set("preferred_locations", arr)} options={US_METROS} allowCustom className="md:col-span-2" />
            <MultiSelectChips label="Desired job titles" values={getArr("desired_titles")} onChange={(arr) => set("desired_titles", arr)} options={["Software Engineer","Senior Software Engineer","Staff Engineer","Frontend Engineer","Backend Engineer","Full Stack Engineer","Data Engineer","ML Engineer","Data Scientist","DevOps Engineer","SRE","Product Manager","Engineering Manager","Designer","Product Designer"]} allowCustom className="md:col-span-2" />
            <MultiSelectChips label="Desired industries" values={getArr("desired_industries")} onChange={(arr) => set("desired_industries", arr)} options={INDUSTRIES} className="md:col-span-2" />
            <MultiSelectChips label="Excluded industries" values={getArr("excluded_industries")} onChange={(arr) => set("excluded_industries", arr)} options={INDUSTRIES} className="md:col-span-2" />
            {/* Employment type & seniority preferences live on filters, not the profile */}

          </CardContent></Card>
        </TabsContent>

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

function SelectField({
  label, value, onChange, options, allowCustom, className,
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; allowCustom?: boolean; className?: string }) {
  const known = options.includes(value);
  const showCustom = allowCustom && value && !known;
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select value={known ? value : (showCustom ? "__custom__" : "")} onValueChange={(v) => { if (v === "__custom__") onChange(""); else onChange(v); }}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          {allowCustom && <SelectItem value="__custom__">Other / custom…</SelectItem>}
        </SelectContent>
      </Select>
      {showCustom && (
        <Input className="mt-2" placeholder="Type custom value" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function SelectFieldKV({
  label, value, onChange, options, className,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiSelectChips({
  label, values, onChange, options, allowCustom, className,
}: { label: string; values: string[]; onChange: (v: string[]) => void; options: string[]; allowCustom?: boolean; className?: string }) {
  const [custom, setCustom] = useState("");
  const remaining = options.filter((o) => !values.includes(o));
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-md border border-input bg-transparent p-2 min-h-9">
        {values.length === 0 && <span className="text-xs text-muted-foreground">None selected</span>}
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Select value="" onValueChange={(v) => { if (v) onChange([...values, v]); }}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Add from list…" /></SelectTrigger>
          <SelectContent className="max-h-72">
            {remaining.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            {remaining.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">All added</div>}
          </SelectContent>
        </Select>
        {allowCustom && (
          <div className="flex gap-1">
            <Input placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-32" />
            <Button type="button" size="sm" variant="outline" onClick={() => { if (custom.trim() && !values.includes(custom.trim())) { onChange([...values, custom.trim()]); setCustom(""); } }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
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
        const opts = SCREENING_OPTIONS[k];
        return (
          <Card key={k}>
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{preset?.label ?? k}</Label>
                <Button size="sm" variant="ghost" onClick={() => remove(k)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">key: <code>{k}</code></p>
              {opts ? (
                <Select value={v} onValueChange={(nv) => update(k, nv)}>
                  <SelectTrigger><SelectValue placeholder="Select an answer…" /></SelectTrigger>
                  <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Textarea rows={2} value={v} onChange={(e) => update(k, e.target.value)} />
              )}
            </CardContent>
          </Card>
        );
      })}

    </div>
  );
}

type FieldDef = { key: string; label: string; type?: string; multi?: boolean; options?: string[]; dateField?: boolean };
const SCHEMAS: Record<string, { fields: FieldDef[]; title: string }> = {
  experiences: {
    title: "Experience",
    fields: [
      { key: "company", label: "Company" },
      { key: "title", label: "Title" },
      { key: "location", label: "Location" },
      { key: "start_date", label: "Start date", dateField: true },
      { key: "end_date", label: "End date (leave empty if current)", dateField: true },
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
      { key: "name", label: "Skill name" },
      { key: "category", label: "Category", options: ["Language", "Framework", "Database", "Cloud / DevOps", "Tool", "Soft skill", "Other"] },
      { key: "proficiency", label: "Proficiency", options: PROFICIENCY_SKILL },
      { key: "years", label: "Years", type: "number" },
    ],
  },
  educations: {
    title: "Education",
    fields: [
      { key: "school", label: "School" },
      { key: "degree", label: "Degree", options: DEGREE },
      { key: "field", label: "Field of study" },
      { key: "start_date", label: "Start date", dateField: true },
      { key: "end_date", label: "End date (or expected)", dateField: true },
      { key: "gpa", label: "GPA" },
      { key: "notes", label: "Notes" },
    ],
  },
  languages: {
    title: "Language",
    fields: [
      { key: "name", label: "Language" },
      { key: "proficiency", label: "Proficiency", options: PROFICIENCY_LANGUAGE },
    ],
  },
  certifications: {
    title: "Certification",
    fields: [
      { key: "name", label: "Name" },
      { key: "issuer", label: "Issuer" },
      { key: "issued_date", label: "Issued", dateField: true },
      { key: "expiry_date", label: "Expiry (if any)", dateField: true },
      { key: "credential_id", label: "Credential ID" },
      { key: "url", label: "URL" },
    ],
  },
  references_list: {
    title: "Reference",
    fields: [
      { key: "name", label: "Name" },
      { key: "relationship", label: "Relationship", options: ["Manager", "Colleague", "Direct report", "Client", "Professor", "Mentor", "Other"] },
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
              if (f.dateField) {
                return (
                  <DatePickerField
                    key={f.key}
                    label={f.label}
                    value={(val as string | null) ?? ""}
                    onChange={(v) => update(it.id, { [f.key]: v })}
                  />
                );
              }
              if (f.options) {
                return (
                  <SelectField
                    key={f.key}
                    label={f.label}
                    value={(val as string | null) ?? ""}
                    onChange={(v) => update(it.id, { [f.key]: v })}
                    options={f.options}
                  />
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
    setTex("");
    load();
    setSelectedId(data.id);
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
