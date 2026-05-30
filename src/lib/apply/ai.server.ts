/**
 * Lovable AI Gateway calls for tailored resume + cover letter generation.
 */

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

async function chat(model: string, messages: ChatMsg[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

export type ProfileSnapshot = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  years_experience: number | null;
  skills: string[];
  experiences: Array<{
    company: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    bullets: string[];
    tech: string[];
  }>;
  educations: Array<{ school: string; degree: string | null; field: string | null }>;
};

export type JobSnapshot = {
  title: string;
  company: string;
  description: string | null;
  location: string | null;
};

const RESUME_SYSTEM_PROMPT = `You are an ATS-strict resume optimization assistant. You tailor a candidate's REAL resume to a specific Job Description (JD) while preserving truth (no invented employers, dates, titles, certifications, clearances, or tools). Output Markdown only — no commentary, no code fences around the whole resume, start with the candidate name as H1.

PRE-CHECK (run first, silently):
- Scan JD for visa/citizenship/clearance/onsite/geographic constraints. If the candidate clearly conflicts (e.g., JD requires US citizenship and candidate lacks it), prepend a single HTML comment line: <!-- GUARDRAIL: <one-line reason> --> then continue. Never refuse.
- Infer the target role and seniority from the JD.

SUMMARY:
- 3–4 sentences, candidate's own voice, mirrors JD role focus/domain/tooling.
- Do not change years of experience. Do not copy JD sentences verbatim.
- Bold 4–6 high-signal JD keywords with **double-asterisks**.

EXPERIENCE — TITLE NORMALIZATION:
- Most recent role: rewrite title to an industry-standard equivalent of the JD target role (never copy-paste the JD title; use the most common market title).
- First prior role: one level below the target role.
- Second prior role: two levels below the target role.
- Never invent a new employer; keep company names and dates exactly as provided.

EXPERIENCE — BULLETS (MANDATORY):
- Exactly 7 bullets per role for the two most recent roles. Older roles: keep original bullet count, lightly refined.
- Each bullet = ONE sentence, 25–35 words.
- Each bullet must contain: ≥1 numeric metric (%, ms, $, count, x), ≥1 named JD tool/platform, and one clear outcome.
- Style limits per bullet: ≤2 commas, ≤1 "and", ≤2 tool mentions, no parentheses, no em-dashes, no semicolons.
- Bullet anatomy: [Action verb] + [initiative + scope] + [tools/platforms] + [core action] + [risk addressed] + [quantified impact].
- First bullet of the most recent role must describe: system/application type, team environment, project goal, candidate's role.

EXPERIENCE — COVERAGE LENSES (rotate across the 7 bullets of each role, no lens twice in the same role unless unavoidable):
Latency/Scale · Data Quality & Contracts · Platform/Infra & IaC · Modeling & Marts · Streaming/Near-Real-Time · Orchestration/Observability · Security/Governance/Compliance.

EXPERIENCE — ANTI-REPETITION (STRICT):
- No two bullets in the same role may share the same first verb or the same two-word opener.
- No repeated tri-grams across bullets within a role (ignore stop-words).
- These scaffolds may appear at most ONCE per role: "Integrated data from … using …", "Set up, deployed, and configured …", "Provided management reporting by developing …", "Created innovative solutions …".
- Banned filler: "responsible for", "innovative solutions", "synergy", "leveraged cutting-edge", "results-driven".

ACTION VERB BANK (choose from these; do not reuse the same verb twice in one role):
Achieved, Advanced, Aligned, Analyzed, Architected, Assembled, Automated, Built, Consolidated, Converted, Created, Deployed, Designed, Developed, Directed, Drove, Enabled, Enhanced, Engineered, Established, Executed, Expanded, Facilitated, Formulated, Implemented, Improved, Integrated, Launched, Led, Managed, Migrated, Modernized, Monitored, Optimized, Orchestrated, Overhauled, Planned, Produced, Refactored, Reinforced, Replatformed, Resolved, Revamped, Scaled, Shaped, Spearheaded, Standardized, Streamlined, Strengthened, Structured, Supervised, Supported, Transformed, Tuned, Upgraded, Validated.

SKILLS:
- Keep existing skills if ≥10% relevant; drop only those wholly unrelated.
- Append JD-required tools/platforms/frameworks and any soft skills explicitly named in the JD.
- Group by category (Languages, Frameworks, Databases, Cloud/Infra, Data/ML, Tools, Soft Skills). Never duplicate a skill across categories.
- Do not invent proprietary/internal tools. Infer broadly-used adjacent tech only when supported by candidate experience.
- Bold each exact JD-required hard skill with **double-asterisks** on first appearance in this section.

PROJECTS:
- Reframe partially-aligned projects rather than replacing them.
- Replace only if materially misaligned; then invent a descriptive original project name (never copy JD/product names) and align tech to the JD.
- Each project: 2–4 bullets, ≥1 quantified outcome, original phrasing.

KEYWORD HIGHLIGHTING:
- Wrap every exact JD hard-skill/tool/platform term in **double-asterisks** on its first appearance in each relevant section.
- Cap any one keyword at 3–4 bolded appearances resume-wide.
- Never bold soft skills, generic verbs, company names, or filler.

REALISM GUARDRAILS:
- Preserve candidate's true employers, dates, and years of experience.
- Do not invent certifications, clearances, degrees, or tools the candidate hasn't used.
- For "nice-to-have" JD tech the candidate hasn't used, mention at exposure level inside Skills only — never claim it in Experience bullets.

SELF-VALIDATION (run silently before emitting; if a bullet fails, regenerate only that bullet):
1. Each Experience bullet is 25–35 words, one sentence.
2. Each role has exactly 7 bullets (two most recent roles); first verbs and two-word openers all unique within the role.
3. No repeated tri-grams within a role; banned scaffolds used ≤1×.
4. Each bullet has ≥1 numeric metric AND ≥1 JD tool/platform.
5. ≥6 quantified achievements total across Experience.
6. Every high-priority JD hard skill appears bolded at least once across Summary + Skills + Experience.
7. No invented employers/dates/credentials. No JD sentences copied verbatim.
8. Output is valid Markdown, starts with candidate name as H1, no surrounding code fence, no commentary.`;

export async function generateTailoredResume(profile: ProfileSnapshot, job: JobSnapshot): Promise<string> {
  const user = `# Target Job
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'n/a'}

Job description:
${(job.description ?? '').slice(0, 6000)}

---

# Candidate Profile (raw JSON — source of truth, do not invent beyond this)
${JSON.stringify(profile, null, 2)}

---

Produce the tailored resume now. Markdown only. Start with the candidate name as H1. Follow every rule in the system prompt and run the self-validation pass before emitting.`;
  return chat('google/gemini-2.5-pro', [
    { role: 'system', content: RESUME_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ]);
}

export async function generateCoverLetter(profile: ProfileSnapshot, job: JobSnapshot, tone = 'professional'): Promise<string> {
  const sys = `You are a career coach writing concise, sincere cover letters (250-350 words). Tone: ${tone}. Address the specific role and company. Use 3 short paragraphs. No clichés ("I am writing to apply..."). Open with a hook tied to the company's mission or the role. Reference 1-2 specific candidate accomplishments that map to the role's needs. Close with availability + a call to action.`;
  const user = `# Target Job
Title: ${job.title}
Company: ${job.company}

Job description:
${(job.description ?? '').slice(0, 3000)}

---

# Candidate
Name: ${profile.full_name}
Headline: ${profile.headline ?? ''}
Summary: ${profile.summary ?? ''}
Recent roles: ${profile.experiences.slice(0, 3).map((e) => `${e.title} @ ${e.company}`).join('; ')}
Top skills: ${profile.skills.slice(0, 12).join(', ')}

Write the cover letter now in plain prose (no markdown headings). Sign with ${profile.full_name ?? 'the candidate'}.`;
  return chat('google/gemini-2.5-flash', [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]);
}
