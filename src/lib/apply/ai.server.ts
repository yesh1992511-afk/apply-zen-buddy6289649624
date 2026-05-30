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

export async function generateTailoredResume(profile: ProfileSnapshot, job: JobSnapshot): Promise<string> {
  const sys = `You are a professional resume writer. Produce a clean, ATS-friendly resume in Markdown tailored to the target job. Use the candidate's REAL data — do not invent experience, employers, dates, or credentials. Reorder/emphasize relevant skills and rewrite bullet points to highlight outcomes that match the job description. Keep it to ~1 page.`;
  const user = `# Target Job
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'n/a'}

Job description:
${(job.description ?? '').slice(0, 4000)}

---

# Candidate Profile (raw)
${JSON.stringify(profile, null, 2)}

---

Write the tailored resume now in Markdown. Start with the candidate name as H1.`;
  return chat('google/gemini-2.5-pro', [
    { role: 'system', content: sys },
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
