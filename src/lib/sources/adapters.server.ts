/**
 * Source adapters — each fetches a provider's public feed and returns
 * normalized job records ready to upsert into `jobs`.
 *
 * Server-only file: ".server.ts" prevents client-bundle leakage.
 */
import { createHash } from 'crypto';

export type NormalizedJob = {
  source_key: string;
  source_job_id: string | null;
  dedupe_hash: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  url: string;
  description: string | null;
  description_html: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  employment_type: string | null;
  seniority: string | null;
  posted_at: string | null;
  raw: unknown;
};

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const mkHash = (source_key: string, id: string | null, url: string) =>
  hash(`${source_key}:${id ?? url}`);

const FETCH_TIMEOUT = 10_000;

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': 'LovableJobBot/1.0', Accept: 'application/json', ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'LovableJobBot/1.0' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

// ============================================================
// Aggregator adapters (no slug required)
// ============================================================

export async function fetchRemoteOK(): Promise<NormalizedJob[]> {
  const data = await fetchJson<Array<Record<string, unknown>>>('https://remoteok.com/api');
  if (!Array.isArray(data)) return [];
  return data
    .filter((j) => j.id && j.position)
    .map((j) => ({
      source_key: 'remoteok',
      source_job_id: String(j.id),
      dedupe_hash: mkHash('remoteok', String(j.id), String(j.url ?? '')),
      title: String(j.position ?? ''),
      company: String(j.company ?? ''),
      location: (j.location as string) || 'Remote',
      remote: 'remote',
      url: String(j.url ?? `https://remoteok.com/remote-jobs/${j.id}`),
      description: typeof j.description === 'string' ? j.description.slice(0, 8000) : null,
      description_html: typeof j.description === 'string' ? j.description : null,
      salary_min: typeof j.salary_min === 'number' ? j.salary_min : null,
      salary_max: typeof j.salary_max === 'number' ? j.salary_max : null,
      salary_currency: 'USD',
      employment_type: 'full_time',
      seniority: null,
      posted_at: j.date ? new Date(String(j.date)).toISOString() : null,
      raw: j,
    }));
}

export async function fetchRemotive(): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>('https://remotive.com/api/remote-jobs');
  if (!data?.jobs) return [];
  return data.jobs.map((j) => ({
    source_key: 'remotive',
    source_job_id: String(j.id),
    dedupe_hash: mkHash('remotive', String(j.id), String(j.url ?? '')),
    title: String(j.title ?? ''),
    company: String(j.company_name ?? ''),
    location: (j.candidate_required_location as string) || 'Remote',
    remote: 'remote',
    url: String(j.url ?? ''),
    description: typeof j.description === 'string' ? j.description.replace(/<[^>]+>/g, ' ').slice(0, 8000) : null,
    description_html: typeof j.description === 'string' ? j.description : null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: (j.job_type as string) || null,
    seniority: null,
    posted_at: j.publication_date ? new Date(String(j.publication_date)).toISOString() : null,
    raw: j,
  }));
}

export async function fetchArbeitnow(): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ data?: Array<Record<string, unknown>> }>('https://www.arbeitnow.com/api/job-board-api');
  if (!data?.data) return [];
  return data.data.map((j) => ({
    source_key: 'arbeitnow',
    source_job_id: String(j.slug ?? j.url ?? ''),
    dedupe_hash: mkHash('arbeitnow', String(j.slug ?? ''), String(j.url ?? '')),
    title: String(j.title ?? ''),
    company: String(j.company_name ?? ''),
    location: (j.location as string) || null,
    remote: j.remote ? 'remote' : null,
    url: String(j.url ?? ''),
    description: typeof j.description === 'string' ? j.description.replace(/<[^>]+>/g, ' ').slice(0, 8000) : null,
    description_html: typeof j.description === 'string' ? j.description : null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: Array.isArray(j.job_types) && j.job_types.length ? String((j.job_types as unknown[])[0]) : null,
    seniority: null,
    posted_at: j.created_at ? new Date(Number(j.created_at) * 1000).toISOString() : null,
    raw: j,
  }));
}

export async function fetchHimalayas(): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>('https://himalayas.app/jobs/api');
  if (!data?.jobs) return [];
  return data.jobs.slice(0, 200).map((j) => ({
    source_key: 'himalayas',
    source_job_id: String(j.guid ?? j.id ?? ''),
    dedupe_hash: mkHash('himalayas', String(j.guid ?? j.id ?? ''), String(j.applicationLink ?? '')),
    title: String(j.title ?? ''),
    company: String(j.companyName ?? ''),
    location: (j.locationRestrictions as string[])?.join(', ') || 'Remote',
    remote: 'remote',
    url: String(j.applicationLink ?? ''),
    description: typeof j.excerpt === 'string' ? j.excerpt : null,
    description_html: typeof j.excerpt === 'string' ? j.excerpt : null,
    salary_min: typeof j.minSalary === 'number' ? j.minSalary : null,
    salary_max: typeof j.maxSalary === 'number' ? j.maxSalary : null,
    salary_currency: (j.currency as string) || 'USD',
    employment_type: (j.employmentType as string) || null,
    seniority: (j.seniority as string) || null,
    posted_at: j.pubDate ? new Date(String(j.pubDate)).toISOString() : null,
    raw: j,
  }));
}

export async function fetchJobicy(): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>('https://jobicy.com/api/v2/remote-jobs?count=100');
  if (!data?.jobs) return [];
  return data.jobs.map((j) => ({
    source_key: 'jobicy',
    source_job_id: String(j.id),
    dedupe_hash: mkHash('jobicy', String(j.id), String(j.url ?? '')),
    title: String(j.jobTitle ?? ''),
    company: String(j.companyName ?? ''),
    location: (j.jobGeo as string) || 'Remote',
    remote: 'remote',
    url: String(j.url ?? ''),
    description: typeof j.jobExcerpt === 'string' ? j.jobExcerpt : null,
    description_html: typeof j.jobDescription === 'string' ? j.jobDescription : null,
    salary_min: typeof j.annualSalaryMin === 'number' ? j.annualSalaryMin : null,
    salary_max: typeof j.annualSalaryMax === 'number' ? j.annualSalaryMax : null,
    salary_currency: (j.salaryCurrency as string) || 'USD',
    employment_type: Array.isArray(j.jobType) && j.jobType.length ? String((j.jobType as unknown[])[0]) : null,
    seniority: (j.jobLevel as string) || null,
    posted_at: j.pubDate ? new Date(String(j.pubDate)).toISOString() : null,
    raw: j,
  }));
}

export async function fetchWeWorkRemotely(): Promise<NormalizedJob[]> {
  const text = await fetchText('https://weworkremotely.com/categories/remote-programming-jobs.rss');
  if (!text) return [];
  const items = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const get = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    if (!m) return '';
    return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
  };
  return items.slice(0, 100).map((block) => {
    const title = get(block, 'title');
    const link = get(block, 'link');
    const pub = get(block, 'pubDate');
    const desc = get(block, 'description');
    const [company, ...rest] = title.split(':').map((s) => s.trim());
    const jobTitle = rest.join(':').trim() || title;
    return {
      source_key: 'weworkremotely',
      source_job_id: link,
      dedupe_hash: mkHash('weworkremotely', null, link),
      title: jobTitle,
      company: company || 'Unknown',
      location: 'Remote',
      remote: 'remote',
      url: link,
      description: desc.replace(/<[^>]+>/g, ' ').slice(0, 8000),
      description_html: desc,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: 'full_time',
      seniority: null,
      posted_at: pub ? new Date(pub).toISOString() : null,
      raw: { title, link, pub },
    };
  });
}

// ============================================================
// ATS adapters (per-company-slug)
// ============================================================

export async function fetchGreenhouse(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  );
  if (!data?.jobs) return [];
  return data.jobs.map((j) => ({
    source_key: `greenhouse:${slug}`,
    source_job_id: String(j.id),
    dedupe_hash: mkHash(`greenhouse:${slug}`, String(j.id), String(j.absolute_url ?? '')),
    title: String(j.title ?? ''),
    company: slug,
    location: (j.location as { name?: string } | null)?.name ?? null,
    remote: null,
    url: String(j.absolute_url ?? ''),
    description: typeof j.content === 'string' ? j.content.replace(/<[^>]+>/g, ' ').slice(0, 8000) : null,
    description_html: typeof j.content === 'string' ? j.content : null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: null,
    seniority: null,
    posted_at: j.updated_at ? new Date(String(j.updated_at)).toISOString() : null,
    raw: j,
  }));
}

export async function fetchLever(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<Array<Record<string, unknown>>>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(data)) return [];
  return data.map((j) => {
    const cat = (j.categories ?? {}) as Record<string, unknown>;
    return {
      source_key: `lever:${slug}`,
      source_job_id: String(j.id),
      dedupe_hash: mkHash(`lever:${slug}`, String(j.id), String(j.hostedUrl ?? '')),
      title: String(j.text ?? ''),
      company: slug,
      location: (cat.location as string) || null,
      remote: typeof cat.location === 'string' && /remote/i.test(cat.location) ? 'remote' : null,
      url: String(j.hostedUrl ?? ''),
      description: typeof j.descriptionPlain === 'string' ? j.descriptionPlain.slice(0, 8000) : null,
      description_html: typeof j.description === 'string' ? j.description : null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: (cat.commitment as string) || null,
      seniority: null,
      posted_at: typeof j.createdAt === 'number' ? new Date(j.createdAt).toISOString() : null,
      raw: j,
    };
  });
}

export async function fetchAshby(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
  );
  if (!data?.jobs) return [];
  return data.jobs.map((j) => ({
    source_key: `ashby:${slug}`,
    source_job_id: String(j.id),
    dedupe_hash: mkHash(`ashby:${slug}`, String(j.id), String(j.jobUrl ?? '')),
    title: String(j.title ?? ''),
    company: slug,
    location: (j.location as string) || null,
    remote: j.isRemote ? 'remote' : null,
    url: String(j.jobUrl ?? ''),
    description: typeof j.descriptionPlain === 'string' ? j.descriptionPlain.slice(0, 8000) : null,
    description_html: typeof j.descriptionHtml === 'string' ? j.descriptionHtml : null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: (j.employmentType as string) || null,
    seniority: null,
    posted_at: j.publishedAt ? new Date(String(j.publishedAt)).toISOString() : null,
    raw: j,
  }));
}

export async function fetchWorkable(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ results?: Array<Record<string, unknown>> }>(
    `https://apply.workable.com/api/v3/accounts/${slug}/jobs`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '', location: [] }) },
  );
  if (!data?.results) return [];
  return data.results.map((j) => ({
    source_key: `workable:${slug}`,
    source_job_id: String(j.shortcode ?? j.id),
    dedupe_hash: mkHash(`workable:${slug}`, String(j.shortcode ?? j.id), ''),
    title: String(j.title ?? ''),
    company: slug,
    location: (j.location as { city?: string; country?: string } | null)
      ? [(j.location as Record<string, string>).city, (j.location as Record<string, string>).country].filter(Boolean).join(', ')
      : null,
    remote: j.remote ? 'remote' : null,
    url: `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
    description: null,
    description_html: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: (j.employment_type as string) || null,
    seniority: null,
    posted_at: j.published_on ? new Date(String(j.published_on)).toISOString() : null,
    raw: j,
  }));
}

export async function fetchSmartRecruiters(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ content?: Array<Record<string, unknown>> }>(
    `https://api.smartrecruiters.com/v1/companies/${slug}/postings`,
  );
  if (!data?.content) return [];
  return data.content.map((j) => {
    const loc = j.location as { city?: string; country?: string } | null;
    return {
      source_key: `smartrecruiters:${slug}`,
      source_job_id: String(j.id),
      dedupe_hash: mkHash(`smartrecruiters:${slug}`, String(j.id), String(j.ref ?? '')),
      title: String(j.name ?? ''),
      company: slug,
      location: loc ? [loc.city, loc.country].filter(Boolean).join(', ') : null,
      remote: null,
      url: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      description: null,
      description_html: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      employment_type: ((j.typeOfEmployment as { label?: string } | null) || {}).label ?? null,
      seniority: ((j.experienceLevel as { label?: string } | null) || {}).label ?? null,
      posted_at: j.releasedDate ? new Date(String(j.releasedDate)).toISOString() : null,
      raw: j,
    };
  });
}

export async function fetchRecruitee(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ offers?: Array<Record<string, unknown>> }>(
    `https://${slug}.recruitee.com/api/offers/`,
  );
  if (!data?.offers) return [];
  return data.offers.map((j) => ({
    source_key: `recruitee:${slug}`,
    source_job_id: String(j.id),
    dedupe_hash: mkHash(`recruitee:${slug}`, String(j.id), String(j.careers_url ?? '')),
    title: String(j.title ?? ''),
    company: (j.company_name as string) || slug,
    location: (j.location as string) || null,
    remote: j.remote ? 'remote' : null,
    url: String(j.careers_url ?? ''),
    description: typeof j.description === 'string' ? j.description.replace(/<[^>]+>/g, ' ').slice(0, 8000) : null,
    description_html: typeof j.description === 'string' ? j.description : null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    employment_type: (j.employment_type_code as string) || null,
    seniority: (j.experience_code as string) || null,
    posted_at: j.created_at ? new Date(String(j.created_at)).toISOString() : null,
    raw: j,
  }));
}

// ============================================================
// Dispatch
// ============================================================

export type SourceSpec = { provider: string; slug?: string };

export async function runSource(spec: SourceSpec): Promise<NormalizedJob[]> {
  switch (spec.provider) {
    case 'remoteok': return fetchRemoteOK();
    case 'remotive': return fetchRemotive();
    case 'arbeitnow': return fetchArbeitnow();
    case 'himalayas': return fetchHimalayas();
    case 'jobicy': return fetchJobicy();
    case 'weworkremotely': return fetchWeWorkRemotely();
    case 'greenhouse': return spec.slug ? fetchGreenhouse(spec.slug) : [];
    case 'lever': return spec.slug ? fetchLever(spec.slug) : [];
    case 'ashby': return spec.slug ? fetchAshby(spec.slug) : [];
    case 'workable': return spec.slug ? fetchWorkable(spec.slug) : [];
    case 'smartrecruiters': return spec.slug ? fetchSmartRecruiters(spec.slug) : [];
    case 'recruitee': return spec.slug ? fetchRecruitee(spec.slug) : [];
    default: return [];
  }
}

// Tier A: aggregators that need no slug
export const AGGREGATOR_PROVIDERS = ['remoteok', 'remotive', 'arbeitnow', 'himalayas', 'jobicy', 'weworkremotely'];
