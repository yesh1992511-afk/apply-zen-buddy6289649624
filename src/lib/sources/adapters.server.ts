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
      description: typeof attrs.body === 'string' ? attrs.body.replace(/<[^>]+>/g, ' ').slice(0, 8000) : null,
      description_html: typeof attrs.body === 'string' ? attrs.body : null,
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
      description: get(b, 'jobDescriptions').replace(/<[^>]+>/g, ' ').slice(0, 8000) || null,
      description_html: get(b, 'jobDescriptions') || null,
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
      description: typeof d.QualificationSummary === 'string' ? (d.QualificationSummary as string).slice(0, 8000) : null,
      description_html: null,
      salary_min: ((d.PositionRemuneration as Array<Record<string, unknown>>)?.[0]?.MinimumRange) ? Number((d.PositionRemuneration as Array<Record<string, unknown>>)[0].MinimumRange) : null,
      salary_max: ((d.PositionRemuneration as Array<Record<string, unknown>>)?.[0]?.MaximumRange) ? Number((d.PositionRemuneration as Array<Record<string, unknown>>)[0].MaximumRange) : null,
      salary_currency: 'USD',
      employment_type: ((d.PositionSchedule as Array<Record<string, unknown>>)?.[0]?.Name as string) || null,
      seniority: null,
      posted_at: d.PublicationStartDate ? new Date(String(d.PublicationStartDate)).toISOString() : null,
      raw: d,
    };
  });
}

// ============================================================
// Apify — reads each actor's LAST SUCCEEDED RUN dataset
// (zero compute cost, instant response, never starts a new run)
// Users schedule actor runs separately via Apify dashboard.
// ============================================================
async function fetchApifyLastRun(actorId: string, sourceKey: string, mapper: (item: Record<string, unknown>) => NormalizedJob | null): Promise<NormalizedJob[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return [];
  const url = `https://api.apify.com/v2/acts/${actorId}/runs/last/dataset/items?token=${token}&status=SUCCEEDED&limit=200&clean=true`;
  const items = await fetchJson<Array<Record<string, unknown>>>(url);
  if (!Array.isArray(items)) return [];
  return items.map(mapper).filter((j): j is NormalizedJob => j !== null);
}

export async function fetchApifyLinkedIn(): Promise<NormalizedJob[]> {
  return fetchApifyLastRun('bebity~linkedin-jobs-scraper', 'apify:linkedin', (it) => {
    const url = String(it.link ?? it.jobUrl ?? '');
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
      posted_at: it.postedAt ? new Date(String(it.postedAt)).toISOString() : null,
      raw: it,
    };
  });
}

export async function fetchApifyIndeed(): Promise<NormalizedJob[]> {
  return fetchApifyLastRun('misceres~indeed-scraper', 'apify:indeed', (it) => {
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
      posted_at: it.postingDateParsed ? new Date(String(it.postingDateParsed)).toISOString() : null,
      raw: it,
    };
  });
}

export async function fetchApifyGlassdoor(): Promise<NormalizedJob[]> {
  return fetchApifyLastRun('bebity~glassdoor-jobs-scraper', 'apify:glassdoor', (it) => {
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
      posted_at: it.postedAt ? new Date(String(it.postedAt)).toISOString() : null,
      raw: it,
    };
  });
}

export async function fetchApifyZipRecruiter(): Promise<NormalizedJob[]> {
  return fetchApifyLastRun('bebity~ziprecruiter-scraper', 'apify:ziprecruiter', (it) => {
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
      posted_at: it.postedTime ? new Date(String(it.postedTime)).toISOString() : null,
      raw: it,
    };
  });
}

export async function fetchApifyWellfound(): Promise<NormalizedJob[]> {
  return fetchApifyLastRun('epctex~wellfound-scraper', 'apify:wellfound', (it) => {
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
      posted_at: it.postedAt ? new Date(String(it.postedAt)).toISOString() : null,
      raw: it,
    };
  });
}

export async function fetchApifyGoogleJobs(): Promise<NormalizedJob[]> {
  return fetchApifyLastRun('dan.poltawski~google-jobs-scraper', 'apify:google_jobs', (it) => {
    const url = String(it.shareLink ?? it.url ?? '');
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
      posted_at: it.postedAt ? new Date(String(it.postedAt)).toISOString() : null,
      raw: it,
    };
  });
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
    case 'teamtailor': return spec.slug ? fetchTeamtailor(spec.slug) : [];
    case 'personio': return spec.slug ? fetchPersonio(spec.slug) : [];
    case 'bamboohr': return spec.slug ? fetchBambooHR(spec.slug) : [];
    case 'usajobs': return fetchUSAJobs(spec.slug || 'software');
    case 'apify:linkedin': return fetchApifyLinkedIn();
    case 'apify:indeed': return fetchApifyIndeed();
    case 'apify:glassdoor': return fetchApifyGlassdoor();
    case 'apify:ziprecruiter': return fetchApifyZipRecruiter();
    case 'apify:wellfound': return fetchApifyWellfound();
    case 'apify:google_jobs': return fetchApifyGoogleJobs();
    default: return [];
  }
}

// Tier A: aggregators that need no slug (every 15min)
export const AGGREGATOR_PROVIDERS = ['remoteok', 'remotive', 'arbeitnow', 'himalayas', 'jobicy', 'weworkremotely'];
// Tier C: USAJobs keyword queries (every 60min)
export const USAJOBS_QUERIES: Array<{ provider: string; slug: string }> = [
  { provider: 'usajobs', slug: 'software' },
  { provider: 'usajobs', slug: 'engineer' },
  { provider: 'usajobs', slug: 'data' },
  { provider: 'usajobs', slug: 'cyber' },
  { provider: 'usajobs', slug: 'analyst' },
  { provider: 'usajobs', slug: 'developer' },
];
// Tier D: Apify cached datasets (every 4h)
export const APIFY_PROVIDERS = [
  'apify:linkedin', 'apify:indeed', 'apify:glassdoor',
  'apify:ziprecruiter', 'apify:wellfound', 'apify:google_jobs',
];
