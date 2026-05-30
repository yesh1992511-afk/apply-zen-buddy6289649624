import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/lib/useAuth";
import { toast } from "sonner";
import { Download, Save, Loader2 } from "lucide-react";

type Profile = Record<string, unknown>;
type Row = Record<string, unknown>;

function fmtMonth(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("en-US", { month: "short", year: "numeric" });
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]).filter(Boolean) : [];
}
function s(v: unknown): string {
  return v == null ? "" : String(v);
}

export function HtmlResume() {
  const { user } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [experiences, setExperiences] = useState<Row[]>([]);
  const [educations, setEducations] = useState<Row[]>([]);
  const [skills, setSkills] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]);
  const [certs, setCerts] = useState<Row[]>([]);
  const [languages, setLanguages] = useState<Row[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, e, ed, sk, pr, ce, lg] = await Promise.all([
        supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("experiences").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
        supabase.from("educations").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
        supabase.from("skills").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
        supabase.from("projects").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
        supabase.from("certifications").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
        supabase.from("languages").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
      ]);
      setProfile((p.data ?? null) as Profile | null);
      setExperiences((e.data ?? []) as Row[]);
      setEducations((ed.data ?? []) as Row[]);
      setSkills((sk.data ?? []) as Row[]);
      setProjects((pr.data ?? []) as Row[]);
      setCerts((ce.data ?? []) as Row[]);
      setLanguages((lg.data ?? []) as Row[]);
    })();
  }, [user]);

  const buildPdf = async (): Promise<Blob | null> => {
    if (!ref.current) return null;
    const mod = await import("html2pdf.js");
    const html2pdf = (mod.default ?? mod) as (el: HTMLElement) => {
      set: (opt: Record<string, unknown>) => unknown;
    };
    const worker = (html2pdf(ref.current) as unknown as {
      set: (opt: Record<string, unknown>) => { output: (t: string) => Promise<Blob> };
    }).set({
      margin: [12, 14, 12, 14],
      filename: `${s(profile?.full_name) || "resume"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    });
    return (await worker.output("blob")) as Blob;
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      const blob = await buildPdf();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${s(profile?.full_name) || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error(`Download failed: ${(err as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };

  const onSaveAsResume = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const blob = await buildPdf();
      if (!blob) return;
      const path = `${user.id}/${Date.now()}-profile-resume.pdf`;
      const up = await supabase.storage.from("resumes").upload(path, blob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw up.error;

      await supabase.from("resumes").update({ is_default: false }).eq("user_id", user.id).eq("kind", "template");
      const ins = await supabase.from("resumes").insert({
        user_id: user.id,
        kind: "template",
        name: `Profile resume — ${new Date().toLocaleDateString()}`,
        is_default: true,
        pdf_storage_path: path,
        markers: [],
      });
      if (ins.error) throw ins.error;
      toast.success("Saved as your default resume");
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const name = s(profile?.full_name) || s(profile?.preferred_name) || "Your Name";
  const email = s(profile?.email);
  const phone = s(profile?.phone);
  const location =
    [s(profile?.city), s(profile?.state_region), s(profile?.country)].filter(Boolean).join(", ") ||
    s(profile?.location);
  const linkedin = s(profile?.linkedin_url);
  const github = s(profile?.github_url);
  const website = s(profile?.personal_website) || s(profile?.portfolio_url);
  const headline = s(profile?.headline);
  const summary = s(profile?.summary);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">Resume (auto-built from your profile)</CardTitle>
          <CardDescription>
            No worker. No LaTeX. Edits to your profile flow into this preview instantly. Download as PDF or save as default.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDownload} disabled={downloading || saving}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-2">Download PDF</span>
          </Button>
          <Button size="sm" onClick={onSaveAsResume} disabled={downloading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-2">Save as default</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[720px] overflow-auto rounded border bg-neutral-200 p-4 dark:bg-neutral-800">
          <div
            ref={ref}
            className="mx-auto bg-white text-[12px] leading-[1.45] text-neutral-900 shadow"
            style={{ width: "210mm", minHeight: "297mm", padding: "16mm 18mm", fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {/* Header */}
            <div style={{ borderBottom: "2px solid #111", paddingBottom: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.3 }}>{name}</div>
              {headline && <div style={{ fontSize: 13, color: "#444", marginTop: 2 }}>{headline}</div>}
              <div style={{ fontSize: 11, color: "#333", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 10 }}>
                {email && <span>{email}</span>}
                {phone && <span>· {phone}</span>}
                {location && <span>· {location}</span>}
                {linkedin && <span>· {linkedin.replace(/^https?:\/\//, "")}</span>}
                {github && <span>· {github.replace(/^https?:\/\//, "")}</span>}
                {website && <span>· {website.replace(/^https?:\/\//, "")}</span>}
              </div>
            </div>

            {summary && (
              <Section title="Summary">
                <p style={{ margin: 0 }}>{summary}</p>
              </Section>
            )}

            {experiences.length > 0 && (
              <Section title="Experience">
                {experiences.map((e) => (
                  <div key={s(e.id)} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{s(e.title)}</span>
                        <span> — {s(e.company)}</span>
                        {s(e.location) && <span style={{ color: "#555" }}> · {s(e.location)}</span>}
                      </div>
                      <div style={{ color: "#555", whiteSpace: "nowrap" }}>
                        {fmtMonth(s(e.start_date))} – {e.is_current ? "Present" : fmtMonth(s(e.end_date))}
                      </div>
                    </div>
                    {arr(e.bullets).length > 0 && (
                      <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                        {arr(e.bullets).map((b, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {arr(e.tech).length > 0 && (
                      <div style={{ marginTop: 3, color: "#555", fontStyle: "italic" }}>
                        {arr(e.tech).join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {projects.length > 0 && (
              <Section title="Projects">
                {projects.map((p) => (
                  <div key={s(p.id)} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 700 }}>
                      {s(p.name)}
                      {s(p.url) && <span style={{ fontWeight: 400, color: "#555" }}> — {s(p.url).replace(/^https?:\/\//, "")}</span>}
                    </div>
                    {s(p.description) && <div>{s(p.description)}</div>}
                    {arr(p.bullets).length > 0 && (
                      <ul style={{ margin: "2px 0 0 18px", padding: 0 }}>
                        {arr(p.bullets).map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                    {arr(p.tech).length > 0 && (
                      <div style={{ color: "#555", fontStyle: "italic" }}>{arr(p.tech).join(" · ")}</div>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {educations.length > 0 && (
              <Section title="Education">
                {educations.map((ed) => (
                  <div key={s(ed.id)} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{s(ed.school)}</span>
                        {s(ed.degree) && <span> — {s(ed.degree)}</span>}
                        {s(ed.field) && <span>, {s(ed.field)}</span>}
                      </div>
                      <div style={{ color: "#555", whiteSpace: "nowrap" }}>
                        {fmtMonth(s(ed.start_date))} – {fmtMonth(s(ed.end_date))}
                      </div>
                    </div>
                    {s(ed.gpa) && <div style={{ color: "#555" }}>GPA: {s(ed.gpa)}</div>}
                    {s(ed.notes) && <div>{s(ed.notes)}</div>}
                  </div>
                ))}
              </Section>
            )}

            {skills.length > 0 && (
              <Section title="Skills">
                <div>{skills.map((sk) => s(sk.name)).filter(Boolean).join(" · ")}</div>
              </Section>
            )}

            {certs.length > 0 && (
              <Section title="Certifications">
                {certs.map((c) => (
                  <div key={s(c.id)}>
                    <span style={{ fontWeight: 700 }}>{s(c.name)}</span>
                    {s(c.issuer) && <span> — {s(c.issuer)}</span>}
                    {s(c.issued_date) && <span style={{ color: "#555" }}> · {fmtMonth(s(c.issued_date))}</span>}
                  </div>
                ))}
              </Section>
            )}

            {languages.length > 0 && (
              <Section title="Languages">
                <div>{languages.map((l) => `${s(l.name)}${s(l.proficiency) ? ` (${s(l.proficiency)})` : ""}`).join(" · ")}</div>
              </Section>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          borderBottom: "1px solid #999",
          marginBottom: 6,
          paddingBottom: 2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
