/**
 * Server-only helper: render full LaTeX resume from profile + child tables.
 */
import { escapeTex, formatDateRange, fmtYear, TEX_PREAMBLE } from "./resume-template";

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state_region: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  summary: string | null;
};

type Experience = {
  company: string;
  title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  bullets: string[] | null;
};

type Project = {
  name: string;
  url: string | null;
  description: string | null;
  bullets: string[] | null;
  tech: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Skill = { name: string; category: string | null };

type Certification = {
  name: string;
  issuer: string | null;
  issued_date: string | null;
};

type Education = {
  school: string;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
  notes: string | null;
};

type Publication = {
  title: string;
  authors: string | null;
  venue: string | null;
  publication_date: string | null;
  url: string | null;
  description: string | null;
};

export type ResumeData = {
  profile: Profile;
  experiences: Experience[];
  projects: Project[];
  skills: Skill[];
  certifications: Certification[];
  educations: Education[];
  publications: Publication[];
};

function header(p: Profile): string {
  const name = (p.full_name || "Your Name").toUpperCase();
  const loc = [p.city, p.state_region].filter(Boolean).join(", ") || p.location || "";
  const parts: string[] = [];
  if (loc) parts.push(escapeTex(loc));
  if (p.phone) parts.push(escapeTex(p.phone));
  if (p.email) parts.push(`\\href{mailto:${p.email}}{${escapeTex(p.email)}}`);
  if (p.linkedin_url) parts.push(`\\href{${p.linkedin_url}}{LinkedIn}`);
  if (p.github_url) parts.push(`\\href{${p.github_url}}{GitHub}`);
  if (p.portfolio_url) parts.push(`\\href{${p.portfolio_url}}{Portfolio}`);

  return [
    `\\begin{center}`,
    `{\\Huge \\scshape ${escapeTex(name)}} \\\\ \\vspace{2pt}`,
    parts.join(" \\textbar\\ "),
    `\\end{center}`,
  ].join("\n");
}

function summarySection(p: Profile): string {
  if (!p.summary || !p.summary.trim()) return "";
  return [
    `%---------------- Summary ----------------`,
    `\\section{Professional Summary}`,
    ``,
    escapeTex(p.summary.trim()),
    ``,
  ].join("\n");
}

function bulletsToItems(bullets: string[] | null | undefined, fallback?: string | null): string {
  let list = (bullets ?? []).filter((b) => b && b.trim());
  if (list.length === 0 && fallback) {
    list = fallback.split(/\r?\n/).map((s) => s.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  }
  if (list.length === 0) return "";
  return list.map((b) => `\\item[$\\bullet$]{${escapeTex(b)}}`).join("\n");
}

function experienceSection(rows: Experience[]): string {
  if (rows.length === 0) return "";
  const blocks = rows.map((e, idx) => {
    const range = formatDateRange(e.start_date, e.end_date, e.is_current ?? false);
    const items = bulletsToItems(e.bullets);
    const spacer = idx < rows.length - 1 ? `\n\n\\vspace{0.2cm}\n` : "";
    return [
      `\\resumeSubheading`,
      `{${escapeTex(e.company)}}{${escapeTex(range)}}`,
      `{${escapeTex(e.title)}}{${escapeTex(e.location ?? "")}}`,
      items ? `\\resumeItemListStart\n${items}\n\\resumeItemListEnd` : "",
      spacer,
    ].filter(Boolean).join("\n");
  });
  return [
    `%---------------- Experience ----------------`,
    `\\section{Professional Experience}`,
    `\\resumeSubHeadingListStart`,
    ``,
    blocks.join("\n"),
    ``,
    `\\resumeSubHeadingListEnd`,
    ``,
  ].join("\n");
}

function projectSection(rows: Project[]): string {
  if (rows.length === 0) return "";
  const blocks = rows.map((p, idx) => {
    const range = formatDateRange(p.start_date, p.end_date, false);
    const techLine = (p.tech ?? []).filter(Boolean).join(", ");
    const items = bulletsToItems(p.bullets, p.description);
    const spacer = idx < rows.length - 1 ? `\n\n\\vspace{0.2cm}\n` : "";
    return [
      `\\item`,
      `\\begin{tabular*}{1.0\\textwidth}{l@{\\extracolsep{\\fill}}r}`,
      `\\small\\textbf{${escapeTex(p.name)}} & \\textbf{\\small ${escapeTex(range)}} \\\\`,
      `\\end{tabular*}\\vspace{1pt}\\\\`,
      techLine ? `\\small\\emph{${escapeTex(techLine)}}` : "",
      `\\vspace{-3pt}`,
      items ? `\\resumeItemListStart\n${items}\n\\resumeItemListEnd` : "",
      spacer,
    ].filter(Boolean).join("\n");
  });
  return [
    `%---------------- Projects ----------------`,
    `\\section{Projects}`,
    `\\resumeSubHeadingListStart`,
    ``,
    blocks.join("\n"),
    ``,
    `\\resumeSubHeadingListEnd`,
    ``,
  ].join("\n");
}

function skillSection(rows: Skill[]): string {
  if (rows.length === 0) return "";
  const groups = new Map<string, string[]>();
  for (const s of rows) {
    const cat = (s.category || "Skills").trim();
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(s.name);
  }
  const items = Array.from(groups.entries()).map(
    ([cat, names]) => `  \\item \\textbf{${escapeTex(cat)}:} ${escapeTex(names.join(", "))}`
  );
  return [
    `%---------------- Skills ----------------`,
    `\\section{Technical Skills}`,
    ``,
    `\\begin{itemize}[leftmargin=*, itemsep=2pt]`,
    items.join("\n"),
    `\\end{itemize}`,
    ``,
  ].join("\n");
}

function certSection(rows: Certification[]): string {
  if (rows.length === 0) return "";
  const items = rows.map((c) => {
    const yr = fmtYear(c.issued_date);
    const issuer = c.issuer ? `, ${escapeTex(c.issuer)}` : "";
    const yrPart = yr ? ` (${yr})` : "";
    return `  \\item \\textbf{${escapeTex(c.name)}}${issuer}${yrPart}`;
  });
  return [
    `%---------------- Certifications ----------------`,
    `\\section{Certifications}`,
    ``,
    `\\begin{itemize}[leftmargin=*, itemsep=2pt]`,
    items.join("\n"),
    `\\end{itemize}`,
    ``,
  ].join("\n");
}

function educationSection(rows: Education[]): string {
  if (rows.length === 0) return "";
  const items = rows.map((e) => {
    const range = formatDateRange(e.start_date, e.end_date, false);
    const degreeParts = [e.degree, e.field].filter(Boolean).join(", ");
    const gpaPart = e.gpa ? ` \\textbar\\ GPA: ${escapeTex(e.gpa)}` : "";
    const line2 = `${escapeTex(degreeParts)}${gpaPart}`;
    return [
      `\\resumeSubheading`,
      `{${escapeTex(e.school)}}{${escapeTex(range)}}`,
      `{${line2}}{${escapeTex(e.notes ?? "")}}`,
    ].join("\n");
  });
  return [
    `%---------------- Education ----------------`,
    `\\section{Education}`,
    `\\resumeSubHeadingListStart`,
    items.join("\n\n"),
    `\\resumeSubHeadingListEnd`,
    ``,
  ].join("\n");
}

function publicationSection(rows: Publication[]): string {
  if (rows.length === 0) return "";
  const items = rows.map((p) => {
    const parts: string[] = [];
    if (p.authors) parts.push(escapeTex(p.authors));
    parts.push(```${escapeTex(p.title)}.''`);
    if (p.venue) parts.push(escapeTex(p.venue) + ".");
    const yr = fmtYear(p.publication_date);
    if (yr) parts.push(`${yr}.`);
    if (p.url) parts.push(`\\href{${p.url}}{${escapeTex(p.url)}}`);
    if (p.description) parts.push(escapeTex(p.description));
    return `  \\item ${parts.join(" ")}`;
  });
  return [
    `%---------------- Publications ----------------`,
    `\\section{Publications}`,
    ``,
    `\\begin{itemize}[leftmargin=*, itemsep=2pt]`,
    items.join("\n"),
    `\\end{itemize}`,
    ``,
  ].join("\n");
}

export function renderResumeTex(data: ResumeData): string {
  const sections = [
    summarySection(data.profile),
    experienceSection(data.experiences),
    projectSection(data.projects),
    skillSection(data.skills),
    certSection(data.certifications),
    educationSection(data.educations),
    publicationSection(data.publications),
  ].filter(Boolean);

  return [
    TEX_PREAMBLE,
    `%---------------- Document ----------------`,
    `\\begin{document}`,
    ``,
    `%---------------- Header ----------------`,
    header(data.profile),
    ``,
    sections.join("\n\n"),
    `\\end{document}`,
    ``,
  ].join("\n");
}
