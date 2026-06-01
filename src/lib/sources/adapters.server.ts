/**
 * Source adapters — each fetches a provider's public feed and returns
 * normalized job records ready to upsert into `jobs`.
 *
 * Server-only file: ".server.ts" prevents client-bundle leakage.
 */
import { createHash } from 'crypto';
import {
  decodeHtmlEntities as _decodeHtmlEntities,
  normalizeDescription,
  stripTags as _stripTags,
} from './normalize.server';
import { runActorSync, ApifyEmptyError } from './apify-client.server';

export { ApifyEmptyError };

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

/** Back-compat re-export so any external import keeps working. */
export const decodeHtmlEntities = _decodeHtmlEntities;

/** Safely parse any date-like value to ISO; returns null for invalid/missing input. */
function safeIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  try {
    const n = typeof v === 'number' ? v : Number(v);
    const d = !Number.isNaN(n) && typeof v !== 'string'
      ? new Date(n < 1e12 ? n * 1000 : n)
      : new Date(String(v));
    const t = d.getTime();
    if (!Number.isFinite(t)) return null;
    return d.toISOString();
  } catch { return null; }
}
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
      ...normalizeDescription(j.description),
      salary_min: typeof j.salary_min === 'number' ? j.salary_min : null,
      salary_max: typeof j.salary_max === 'number' ? j.salary_max : null,
      salary_currency: 'USD',
      employment_type: 'full_time',
      seniority: null,
      posted_at: j.date ? new Date(String(j.date)).toISOString() : null,
      raw: j,
    }));
}

export async function fetchRemotive(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const query = ctx?.queries?.find((q) => q.trim()) ?? 'cybersecurity';
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`;
  const data = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>(url);
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
    ...normalizeDescription(j.description),
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
    ...normalizeDescription(j.description),
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
    ...normalizeDescription(j.excerpt),
    salary_min: typeof j.minSalary === 'number' ? j.minSalary : null,
    salary_max: typeof j.maxSalary === 'number' ? j.maxSalary : null,
    salary_currency: (j.currency as string) || 'USD',
    employment_type: (j.employmentType as string) || null,
    seniority: (j.seniority as string) || null,
    posted_at: safeIsoDate(j.pubDate),
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
    ...normalizeDescription((j.jobDescription as string) || (j.jobExcerpt as string)),
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
      ...normalizeDescription(desc),
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
    ...normalizeDescription(j.content),
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
      ...normalizeDescription((j.description as string) || (j.descriptionPlain as string)),
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
    ...normalizeDescription((j.descriptionHtml as string) || (j.descriptionPlain as string)),
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
    ...normalizeDescription(j.description),
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
// Teamtailor (public API, per-company slug)
// ============================================================
export async function fetchTeamtailor(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ data?: Array<Record<string, unknown>> }>(
    `https://${slug}.teamtailor.com/api/v1/jobs?include=department,location&page[size]=100`,
    { headers: { 'X-Api-Version': '20210218' } },
  );
  if (!data?.data) return [];
  return data.data.map((j) => {
    const attrs = (j.attributes ?? {}) as Record<string, unknown>;
    const url = String(((j.links ?? {}) as Record<string, unknown>)['careersite-job-url'] ?? '');
    return {
      source_key: `teamtailor:${slug}`,
      source_job_id: String(j.id),
      dedupe_hash: mkHash(`teamtailor:${slug}`, String(j.id), url),
      title: String(attrs.title ?? ''),
      company: slug,
      location: null,
      remote: attrs['remote-status'] === 'fully' ? 'remote' : null,
      url,
      ...normalizeDescription(attrs.body),
      salary_min: null, salary_max: null, salary_currency: null,
      employment_type: (attrs['employment-type'] as string) || null,
      seniority: (attrs['experience'] as string) || null,
      posted_at: attrs['start-date'] ? new Date(String(attrs['start-date'])).toISOString() : null,
      raw: j,
    };
  });
}

// ============================================================
// Personio (public XML feed, per-company slug)
// ============================================================
export async function fetchPersonio(slug: string): Promise<NormalizedJob[]> {
  const xml = await fetchText(`https://${slug}.jobs.personio.de/xml`);
  if (!xml) return [];
  const positions = xml.match(/<position>[\s\S]*?<\/position>/g) ?? [];
  const get = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
  };
  return positions.slice(0, 200).map((b) => {
    const id = get(b, 'id');
    const name = get(b, 'name');
    const office = get(b, 'office');
    const url = `https://${slug}.jobs.personio.de/job/${id}`;
    return {
      source_key: `personio:${slug}`,
      source_job_id: id,
      dedupe_hash: mkHash(`personio:${slug}`, id, url),
      title: name,
      company: slug,
      location: office || null,
      remote: /remote/i.test(office) ? 'remote' : null,
      url,
      ...normalizeDescription(get(b, 'jobDescriptions')),
      salary_min: null, salary_max: null, salary_currency: null,
      employment_type: get(b, 'employmentType') || null,
      seniority: get(b, 'seniority') || null,
      posted_at: get(b, 'createdAt') ? new Date(get(b, 'createdAt')).toISOString() : null,
      raw: { id, name, office },
    };
  });
}

// ============================================================
// BambooHR (public JSON feed, per-company slug)
// ============================================================
export async function fetchBambooHR(slug: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<{ result?: Array<Record<string, unknown>> }>(
    `https://${slug}.bamboohr.com/careers/list`,
  );
  if (!data?.result) return [];
  return data.result.map((j) => {
    const loc = (j.location ?? {}) as Record<string, string>;
    const id = String(j.id);
    const url = `https://${slug}.bamboohr.com/careers/${id}`;
    return {
      source_key: `bamboohr:${slug}`,
      source_job_id: id,
      dedupe_hash: mkHash(`bamboohr:${slug}`, id, url),
      title: String(j.jobOpeningName ?? ''),
      company: String(j.departmentLabel ?? slug),
      location: [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || null,
      remote: j.isRemote ? 'remote' : null,
      url,
      description: null, description_html: null,
      salary_min: null, salary_max: null, salary_currency: null,
      employment_type: (j.employmentStatusLabel as string) || null,
      seniority: null,
      posted_at: j.datePosted ? new Date(String(j.datePosted)).toISOString() : null,
      raw: j,
    };
  });
}

// ============================================================
// USAJobs (federal API, requires API key + user-agent email)
// ============================================================
export async function fetchUSAJobs(keyword = 'software', location = ''): Promise<NormalizedJob[]> {
  const apiKey = process.env.USAJOBS_API_KEY;
  const userAgent = process.env.USAJOBS_USER_AGENT_EMAIL;
  if (!apiKey || !userAgent) return [];
  const params = new URLSearchParams({ Keyword: keyword, ResultsPerPage: '100' });
  if (location) params.set('LocationName', location);
  const data = await fetchJson<{ SearchResult?: { SearchResultItems?: Array<Record<string, unknown>> } }>(
    `https://data.usajobs.gov/api/search?${params}`,
    {
      headers: {
        'Host': 'data.usajobs.gov',
        'User-Agent': userAgent,
        'Authorization-Key': apiKey,
      },
    },
  );
  const items = data?.SearchResult?.SearchResultItems ?? [];
  return items.map((it) => {
    const d = ((it as Record<string, unknown>).MatchedObjectDescriptor ?? {}) as Record<string, unknown>;
    const id = String(d.PositionID ?? '');
    const url = String(d.PositionURI ?? '');
    const locs = (d.PositionLocation as Array<Record<string, unknown>>) ?? [];
    return {
      source_key: 'usajobs',
      source_job_id: id,
      dedupe_hash: mkHash('usajobs', id, url),
      title: String(d.PositionTitle ?? ''),
      company: String((d.OrganizationName as string) ?? 'US Government'),
      location: locs.map((l) => l.LocationName).filter(Boolean).join('; ') || null,
      remote: /remote/i.test(String(d.PositionTitle ?? '')) ? 'remote' : null,
      url,
      ...normalizeDescription(d.QualificationSummary),
      salary_min: ((d.PositionRemuneration as Array<Record<string, unknown>>)?.[0]?.MinimumRange) ? Math.round(Number((d.PositionRemuneration as Array<Record<string, unknown>>)[0].MinimumRange)) : null,
      salary_max: ((d.PositionRemuneration as Array<Record<string, unknown>>)?.[0]?.MaximumRange) ? Math.round(Number((d.PositionRemuneration as Array<Record<string, unknown>>)[0].MaximumRange)) : null,
      salary_currency: 'USD',
      employment_type: ((d.PositionSchedule as Array<Record<string, unknown>>)?.[0]?.Name as string) || null,
      seniority: null,
      posted_at: d.PublicationStartDate ? new Date(String(d.PublicationStartDate)).toISOString() : null,
      raw: d,
    };
  });
}

// ============================================================
// Apify — triggers a fresh actor run with the user's keywords/locations
// via run-sync-get-dataset-items. Costs Apify compute, but returns
// fresh, targeted jobs instead of stale cached datasets.
//
// Each actor expects a DIFFERENT input schema. Most of the consumer-site
// scrapers (LinkedIn, Glassdoor, ZipRecruiter, Wellfound) take an array
// of pre-built search URLs, NOT free-form keywords. Sending
// `{ queries, locations }` to those actors results in a successful run
// with 0 items every time — which is exactly what was happening before
// this rewrite.
// ============================================================
const APIFY_RUN_TIMEOUT_MS = 110_000; // a touch under the run-tier 120s cap

// Hard cap on (query × location) URLs per actor run, so 20 cyber keywords
// don't blow past Apify's sync 100s window.
const APIFY_MAX_URLS_PER_ACTOR = 8;

async function runApifyActor(
  actorId: string,
  payload: Record<string, unknown>,
): Promise<Array<Record<string, unknown>>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];
  const url =
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=100&memory=1024&clean=true`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), APIFY_RUN_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'LovableJobBot/1.0' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`apify ${actorId} ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const arr = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    // Lightweight observability: server logs let us tell "0 items but
    // ran" from "garbage in" after the fact.
    if (arr.length === 0) {
      console.log(
        `[apify] ${actorId} returned 0 items; payload keys=${Object.keys(payload).join(',')}`,
      );
    }
    return arr;
  } finally {
    clearTimeout(to);
  }
}

export type ApifyCtx = { queries: string[]; locations: string[] };

const defaultCtx = (ctx?: ApifyCtx): ApifyCtx => ({
  queries: ctx?.queries?.length ? ctx.queries : ['software engineer'],
  locations: ctx?.locations?.length ? ctx.locations : ['United States'],
});

/** Pick the most specific queries first (longer phrases are more targeted),
 *  pair with each location, and cap the total fan-out. */
function pairQueriesLocations(
  ctx: ApifyCtx,
  cap = APIFY_MAX_URLS_PER_ACTOR,
): Array<{ q: string; loc: string }> {
  const queries = [...ctx.queries].sort((a, b) => b.length - a.length);
  const locs = ctx.locations.length ? ctx.locations : ['United States'];
  const out: Array<{ q: string; loc: string }> = [];
  for (const loc of locs) {
    for (const q of queries) {
      if (out.length >= cap) return out;
      out.push({ q, loc });
    }
  }
  return out;
}

function buildLinkedInSearchUrls(ctx: ApifyCtx): string[] {
  return pairQueriesLocations(ctx).map(({ q, loc }) => {
    const params = new URLSearchParams({
      keywords: q,
      location: loc,
      f_TPR: 'r604800', // last 7 days
      sortBy: 'DD',     // date-descending
    });
    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  });
}

function buildGlassdoorSearchUrls(ctx: ApifyCtx): string[] {
  return pairQueriesLocations(ctx).map(({ q, loc }) => {
    const params = new URLSearchParams({
      sc_keyword: q,
      locT: 'N',
      locName: loc,
    });
    return `https://www.glassdoor.com/Job/jobs.htm?${params.toString()}`;
  });
}

function buildZipRecruiterSearchUrls(ctx: ApifyCtx): string[] {
  return pairQueriesLocations(ctx).map(({ q, loc }) => {
    const params = new URLSearchParams({
      search: q,
      location: loc,
      days: '7',
    });
    return `https://www.ziprecruiter.com/jobs-search?${params.toString()}`;
  });
}

function buildWellfoundStartUrls(ctx: ApifyCtx): Array<{ url: string }> {
  return pairQueriesLocations(ctx, 4).map(({ q, loc }) => {
    const slugRole = q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugLoc = loc.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return { url: `https://wellfound.com/role/l/${slugRole}/${slugLoc}` };
  });
}

export async function fetchApifyLinkedIn(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const c = defaultCtx(ctx);
  const urls = buildLinkedInSearchUrls(c);
  if (!urls.length) return [];
  // bebity/linkedin-jobs-scraper documented input:
  // { urls: string[], scrapeCompany?: bool, count?: number, proxy?: ... }
  const items = await runApifyActor('bebity~linkedin-jobs-scraper', {
    urls,
    scrapeCompany: false,
    count: 50,
    proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
  });
  return items
    .map((it) => {
      const url = String(it.link ?? it.jobUrl ?? it.url ?? '');
      if (!url) return null;
      return {
        source_key: 'apify:linkedin',
        source_job_id: String(it.id ?? url),
        dedupe_hash: mkHash('apify:linkedin', String(it.id ?? null), url),
        title: String(it.title ?? it.position ?? ''),
        company: String(it.companyName ?? it.company ?? ''),
        location: (it.location as string) || null,
        remote: /remote/i.test(String(it.location ?? '')) ? 'remote' : null,
        url,
        description: typeof it.description === 'string' ? it.description.slice(0, 8000) : null,
        description_html: null,
        salary_min: null, salary_max: null, salary_currency: null,
        employment_type: (it.employmentType as string) || null,
        seniority: (it.seniorityLevel as string) || null,
        posted_at: safeIsoDate(it.postedAt ?? it.publishedAt ?? it.postedTime),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

export async function fetchApifyIndeed(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const c = defaultCtx(ctx);
  // misceres/indeed-scraper takes single position + location. Run a few
  // queries serially (top-N most specific) and merge.
  const pairs = pairQueriesLocations(c, 4);
  const all: Array<Record<string, unknown>> = [];
  for (const { q, loc } of pairs) {
    const items = await runApifyActor('misceres~indeed-scraper', {
      position: q,
      country: 'US',
      location: loc,
      maxItems: 30,
      parseCompanyDetails: false,
      saveOnlyUniqueItems: true,
    });
    all.push(...items);
  }
  return all
    .map((it) => {
      const url = String(it.url ?? it.externalApplyLink ?? '');
      if (!url) return null;
      return {
        source_key: 'apify:indeed',
        source_job_id: String(it.id ?? it.jobkey ?? url),
        dedupe_hash: mkHash('apify:indeed', String(it.id ?? it.jobkey ?? null), url),
        title: String(it.positionName ?? it.title ?? ''),
        company: String(it.company ?? ''),
        location: (it.location as string) || null,
        remote: /remote/i.test(String(it.location ?? '')) ? 'remote' : null,
        url,
        description: typeof it.description === 'string' ? it.description.slice(0, 8000) : null,
        description_html: null,
        salary_min: null, salary_max: null,
        salary_currency: (it.salary as { currency?: string } | undefined)?.currency ?? null,
        employment_type: (it.jobType as string) || null,
        seniority: null,
        posted_at: safeIsoDate(it.postingDateParsed ?? it.postedAt),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

export async function fetchApifyGlassdoor(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const c = defaultCtx(ctx);
  const urls = buildGlassdoorSearchUrls(c);
  if (!urls.length) return [];
  const items = await runApifyActor('bebity~glassdoor-jobs-scraper', {
    urls,
    count: 50,
    proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
  });
  return items
    .map((it) => {
      const url = String(it.url ?? it.jobUrl ?? '');
      if (!url) return null;
      return {
        source_key: 'apify:glassdoor',
        source_job_id: String(it.id ?? url),
        dedupe_hash: mkHash('apify:glassdoor', String(it.id ?? null), url),
        title: String(it.jobTitle ?? it.title ?? ''),
        company: String(it.companyName ?? ''),
        location: (it.location as string) || null,
        remote: null,
        url,
        description: typeof it.description === 'string' ? it.description.slice(0, 8000) : null,
        description_html: null,
        salary_min: null, salary_max: null, salary_currency: null,
        employment_type: null, seniority: null,
        posted_at: safeIsoDate(it.postedAt),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

export async function fetchApifyZipRecruiter(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const c = defaultCtx(ctx);
  const searchUrls = buildZipRecruiterSearchUrls(c).map((url) => ({ url }));
  if (!searchUrls.length) return [];
  const items = await runApifyActor('bebity~ziprecruiter-scraper', {
    searchUrls,
    maxItems: 50,
    proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
  });
  return items
    .map((it) => {
      const url = String(it.url ?? '');
      if (!url) return null;
      return {
        source_key: 'apify:ziprecruiter',
        source_job_id: String(it.id ?? url),
        dedupe_hash: mkHash('apify:ziprecruiter', String(it.id ?? null), url),
        title: String(it.title ?? it.name ?? ''),
        company: String(it.company ?? it.hiringCompany ?? ''),
        location: (it.location as string) || null,
        remote: /remote/i.test(String(it.location ?? '')) ? 'remote' : null,
        url,
        description: typeof it.description === 'string' ? it.description.slice(0, 8000) : null,
        description_html: null,
        salary_min: null, salary_max: null, salary_currency: 'USD',
        employment_type: (it.employmentType as string) || null,
        seniority: null,
        posted_at: safeIsoDate(it.postedTime),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

export async function fetchApifyWellfound(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const c = defaultCtx(ctx);
  const startUrls = buildWellfoundStartUrls(c);
  if (!startUrls.length) return [];
  const items = await runApifyActor('epctex~wellfound-scraper', {
    startUrls,
    maxItems: 50,
    proxy: { useApifyProxy: true },
  });
  return items
    .map((it) => {
      const url = String(it.url ?? it.jobUrl ?? '');
      if (!url) return null;
      return {
        source_key: 'apify:wellfound',
        source_job_id: String(it.id ?? url),
        dedupe_hash: mkHash('apify:wellfound', String(it.id ?? null), url),
        title: String(it.title ?? ''),
        company: String(it.companyName ?? it.startupName ?? ''),
        location: (it.location as string) || null,
        remote: it.remote ? 'remote' : null,
        url,
        description: typeof it.description === 'string' ? it.description.slice(0, 8000) : null,
        description_html: null,
        salary_min: (it.salaryMin as number) ?? null,
        salary_max: (it.salaryMax as number) ?? null,
        salary_currency: (it.salaryCurrency as string) || 'USD',
        employment_type: (it.jobType as string) || null,
        seniority: null,
        posted_at: safeIsoDate(it.postedAt),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

export async function fetchApifyGoogleJobs(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const c = defaultCtx(ctx);
  // Cap to top-N queries to stay under sync timeout.
  const queries = [...c.queries].sort((a, b) => b.length - a.length).slice(0, 6);
  if (!queries.length) return [];
  const items = await runApifyActor('dan.poltawski~google-jobs-scraper', {
    queries,
    countryCode: 'us',
    languageCode: 'en',
    maxPagesPerQuery: 2,
  });
  return items
    .map((it) => {
      const url = String(it.shareLink ?? it.url ?? it.applyLink ?? '');
      if (!url) return null;
      return {
        source_key: 'apify:google_jobs',
        source_job_id: String(it.jobId ?? url),
        dedupe_hash: mkHash('apify:google_jobs', String(it.jobId ?? null), url),
        title: String(it.title ?? ''),
        company: String(it.companyName ?? ''),
        location: (it.location as string) || null,
        remote: /remote/i.test(String(it.location ?? '')) ? 'remote' : null,
        url,
        description: typeof it.description === 'string' ? it.description.slice(0, 8000) : null,
        description_html: null,
        salary_min: null, salary_max: null, salary_currency: null,
        employment_type: null, seniority: null,
        posted_at: safeIsoDate(it.postedAt),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

// ============================================================
// InfoSec-Jobs / isecjobs — dedicated cybersecurity job board.
// ============================================================
function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(input: string): string {
  return decodeHtml(input.replace(/<[^>]+>/g, ' '));
}

function parseIsecJobsHtml(html: string): NormalizedJob[] {
  const abs = (u: string) => (u.startsWith('http') ? u : `https://isecjobs.com${u.startsWith('/') ? '' : '/'}${u}`);
  const blocks = html.match(/<li class="d-flex justify-content-between position-relative pb-2">[\s\S]*?<\/li>/g) ?? [];
  return blocks.map((block) => {
    const linkMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?([^<]+)\s*<\/a>/i);
    if (!linkMatch) return null;
    const url = abs(decodeHtml(linkMatch[1]));
    const title = decodeHtml(linkMatch[2]);
    const salary = block.match(/<span class="text-bg-secondary px-1 rounded">([^<]+)<\/span>/i)?.[1] ?? '';
    const tagLine = Array.from(block.matchAll(/<span>([^<]+)<\/span>/g)).map((m) => decodeHtml(m[1])).join(' | ');
    const right = block.match(/<div class="text-end">([\s\S]*?)<\/div>\s*<\/li>/i)?.[1] ?? '';
    const plainRight = stripTags(right);
    const location = plainRight.replace(/(Entry-level|Junior|Mid-level|Intermediate|Senior-level|Expert|Executive-level|Director|Full Time|Part Time|Contract|\d+d ago|\d+h ago)/gi, ' ').replace(/\s+/g, ' ').trim() || 'Remote';
    const slug = url.split('/job/')[1]?.replace(/\/$/, '') ?? url;
    return {
      source_key: 'infosec_jobs',
      source_job_id: slug,
      dedupe_hash: mkHash('infosec_jobs', slug, url),
      title: title.slice(0, 500),
      company: 'isecjobs',
      location: location.slice(0, 300),
      remote: /remote/i.test(location) ? 'remote' : null,
      url,
      description: [tagLine, salary ? `Salary: ${decodeHtml(salary)}` : ''].filter(Boolean).join('\n').slice(0, 8000) || null,
      description_html: null,
      salary_min: null, salary_max: null, salary_currency: salary.includes('USD') ? 'USD' : null,
      employment_type: /full time/i.test(plainRight) ? 'full_time' : null,
      seniority: /(senior|expert)/i.test(plainRight) ? 'senior' : /(entry|junior)/i.test(plainRight) ? 'entry' : null,
      posted_at: null,
      raw: { url, title, salary, tagLine, location },
    } as NormalizedJob;
  }).filter((j): j is NormalizedJob => j !== null)
    .filter((j) => {
      const loc = (j.location ?? '').toLowerCase();
      return loc.includes('united states') || loc.includes('remote');
    });
}

export async function fetchInfosecJobs(ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  const html = await fetchText('https://isecjobs.com/');
  if (html) return parseIsecJobsHtml(html).slice(0, 150);

  const data = await fetchJson<unknown>('https://isecjobs.com/api/jobs?limit=150');
  let items: Array<Record<string, unknown>> = [];
  if (Array.isArray(data)) items = data as Array<Record<string, unknown>>;
  else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    items = (obj.jobs ?? obj.results ?? obj.data ?? []) as Array<Record<string, unknown>>;
  }
  const queries = (ctx?.queries ?? []).map((q) => q.toLowerCase());
  return items
    .map((it) => {
      const title = String(it.title ?? it.position ?? '').trim();
      const company = String(it.company ?? it.company_name ?? '').trim();
      const slug = String(it.slug ?? it.id ?? '');
      const url = String(it.url ?? it.link ?? (slug ? `https://isecjobs.com/job/${slug}` : ''));
      if (!title || !company || !url) return null;
      const loc = String(it.location ?? it.city ?? 'Remote').trim();
      const desc = typeof it.description === 'string' ? it.description : (it.summary as string ?? '');
      if (queries.length) {
        const hay = `${title} ${desc}`.toLowerCase();
        if (!queries.some((q) => hay.includes(q))) return null;
      }
      return {
        source_key: 'infosec_jobs',
        source_job_id: slug || url,
        dedupe_hash: mkHash('infosec_jobs', slug || null, url),
        title: title.slice(0, 500),
        company: company.slice(0, 300),
        location: loc.slice(0, 300),
        remote: /remote/i.test(loc) ? 'remote' : null,
        url,
        description: desc ? desc.slice(0, 8000) : null,
        description_html: null,
        salary_min: null, salary_max: null, salary_currency: null,
        employment_type: (it.employment_type as string) || null,
        seniority: null,
        posted_at: safeIsoDate(it.published_at ?? it.posted_at ?? it.date),
        raw: it,
      } as NormalizedJob;
    })
    .filter((j): j is NormalizedJob => j !== null);
}

// ============================================================
// Dispatch
// ============================================================

export type SourceSpec = { provider: string; slug?: string };

// Keyword relevance gate. Respects the user's configured target titles
// (ctx.queries). If no queries are provided, jobs pass through unfiltered
// — better to surface noise than to silently drop every job for users
// who target fields other than cybersecurity.
function buildRelevanceRegex(queries: string[] | undefined): RegExp | null {
  if (!queries) return null;
  const cleaned = queries.map((q) => q.trim().toLowerCase()).filter((q) => q.length >= 2);
  if (cleaned.length === 0) return null;
  const escaped = cleaned.map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'i');
}

function isRelevant(j: NormalizedJob, re: RegExp | null): boolean {
  if (!re) return true;
  const hay = `${j.title} ${j.company} ${j.description ?? ''}`;
  return re.test(hay);
}

export async function runSource(spec: SourceSpec, ctx?: ApifyCtx): Promise<NormalizedJob[]> {
  let jobs: NormalizedJob[];
  switch (spec.provider) {
    case 'remoteok': jobs = await fetchRemoteOK(); break;
    case 'remotive': jobs = await fetchRemotive(ctx); break;
    case 'arbeitnow': jobs = await fetchArbeitnow(); break;
    case 'himalayas': jobs = await fetchHimalayas(); break;
    case 'jobicy': jobs = await fetchJobicy(); break;
    case 'weworkremotely': jobs = await fetchWeWorkRemotely(); break;
    case 'infosec_jobs': jobs = await fetchInfosecJobs(ctx); break;
    case 'greenhouse': jobs = spec.slug ? await fetchGreenhouse(spec.slug) : []; break;
    case 'lever': jobs = spec.slug ? await fetchLever(spec.slug) : []; break;
    case 'ashby': jobs = spec.slug ? await fetchAshby(spec.slug) : []; break;
    case 'workable': jobs = spec.slug ? await fetchWorkable(spec.slug) : []; break;
    case 'smartrecruiters': jobs = spec.slug ? await fetchSmartRecruiters(spec.slug) : []; break;
    case 'recruitee': jobs = spec.slug ? await fetchRecruitee(spec.slug) : []; break;
    case 'teamtailor': jobs = spec.slug ? await fetchTeamtailor(spec.slug) : []; break;
    case 'personio': jobs = spec.slug ? await fetchPersonio(spec.slug) : []; break;
    case 'bamboohr': jobs = spec.slug ? await fetchBambooHR(spec.slug) : []; break;
    case 'usajobs': jobs = await fetchUSAJobs(spec.slug || 'cyber'); break;
    case 'apify:linkedin': jobs = await fetchApifyLinkedIn(ctx); break;
    case 'apify:indeed': jobs = await fetchApifyIndeed(ctx); break;
    case 'apify:glassdoor': jobs = await fetchApifyGlassdoor(ctx); break;
    case 'apify:ziprecruiter': jobs = await fetchApifyZipRecruiter(ctx); break;
    case 'apify:wellfound': jobs = await fetchApifyWellfound(ctx); break;
    case 'apify:google_jobs': jobs = await fetchApifyGoogleJobs(ctx); break;
    default: jobs = [];
  }

  // Keyword relevance gate driven by the user's configured target titles.
  // Boards / ATS slugs are curated per-company so we skip the gate for them
  // and rely on per-user filters/scoring downstream.
  const SLUG_BASED = new Set(['greenhouse','lever','ashby','workable','smartrecruiters','recruitee','teamtailor','personio','bamboohr']);
  if (!SLUG_BASED.has(spec.provider) && jobs.length > 0) {
    const re = buildRelevanceRegex(ctx?.queries);
    if (re) jobs = jobs.filter((j) => isRelevant(j, re));
  }
  return jobs;
}

// Tier A: aggregators that need no slug (every 15min)
export const AGGREGATOR_PROVIDERS = ['remoteok', 'remotive', 'arbeitnow', 'himalayas', 'jobicy', 'weworkremotely', 'infosec_jobs'];
// Tier C: USAJobs keyword queries (every 60min)
export const USAJOBS_QUERIES: Array<{ provider: string; slug: string }> = [
  { provider: 'usajobs', slug: 'cyber' },
  { provider: 'usajobs', slug: 'security' },
  { provider: 'usajobs', slug: 'information assurance' },
  { provider: 'usajobs', slug: 'penetration tester' },
  { provider: 'usajobs', slug: 'incident response' },
];
// Tier D: Apify (every 4h) — now triggers fresh runs with user keywords
export const APIFY_PROVIDERS = [
  'apify:linkedin', 'apify:indeed', 'apify:glassdoor',
  'apify:ziprecruiter', 'apify:wellfound', 'apify:google_jobs',
];
