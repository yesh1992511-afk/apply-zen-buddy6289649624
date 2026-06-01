/**
 * Apify run wrapper with real diagnostics.
 *
 * Why: the previous wrapper silently returned `[]` on every failure mode —
 * HTTP errors, actor crashes, schema mismatches, empty datasets — so the
 * Sources UI showed `succeeded / 0` and the user had no idea why.
 *
 * Now:
 *  - non-2xx HTTP   → throws `ApifyError` (caller marks source `failed`)
 *  - actor finished with non-SUCCEEDED status → throws `ApifyError` with
 *    the actor's own status message + log tail
 *  - actor SUCCEEDED but dataset is empty → throws `ApifyEmptyError`
 *    carrying a precise human reason; caller records it as `succeeded`
 *    but writes the reason into `sources.last_error` so the user can act
 *    on it instead of staring at a generic "0".
 */

const APIFY_BASE = 'https://api.apify.com/v2';
const DEFAULT_TIMEOUT_SEC = 100;
const FETCH_TIMEOUT_MS = 115_000; // a hair above Apify's run-sync ceiling

export class ApifyError extends Error {
  readonly kind = 'apify_error';
  constructor(message: string, readonly actorId: string, readonly runId?: string) {
    super(message);
    this.name = 'ApifyError';
  }
}

export class ApifyEmptyError extends Error {
  readonly kind = 'apify_empty';
  constructor(
    message: string,
    readonly actorId: string,
    readonly runId?: string,
    readonly runStatus?: string,
  ) {
    super(message);
    this.name = 'ApifyEmptyError';
  }
}

type DatasetItems = Array<Record<string, unknown>>;

async function fetchJsonSafe(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchTextSafe(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function summarizeInput(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) parts.push(`${k}=[${v.length}]`);
    else if (typeof v === 'object') parts.push(`${k}={…}`);
    else parts.push(`${k}=${String(v).slice(0, 40)}`);
    if (parts.length >= 6) break;
  }
  return parts.join(' ');
}

/**
 * Run an Apify actor synchronously and return the dataset items.
 * Throws ApifyError / ApifyEmptyError on any non-success outcome so callers
 * can record an honest status.
 */
export async function runActorSync(
  actorId: string,
  payload: Record<string, unknown>,
  opts: { token?: string; timeoutSec?: number } = {},
): Promise<DatasetItems> {
  const token = opts.token ?? process.env.APIFY_TOKEN;
  if (!token) throw new ApifyError('APIFY_TOKEN is not configured', actorId);
  const timeoutSec = opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC;

  const url =
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items` +
    `?token=${token}&timeout=${timeoutSec}&memory=1024&clean=true&format=json`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'LovableJobBot/1.0' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    clearTimeout(to);
    throw new ApifyError(`fetch failed: ${String(e).slice(0, 200)} [input: ${summarizeInput(payload)}]`, actorId);
  } finally {
    clearTimeout(to);
  }

  const runId = res.headers.get('x-apify-pagination-run-id') ?? undefined;

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new ApifyError(
      `HTTP ${res.status} ${res.statusText}: ${bodyText.slice(0, 300)} [input: ${summarizeInput(payload)}]`,
      actorId,
      runId,
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (e) {
    throw new ApifyError(`invalid JSON response: ${String(e).slice(0, 200)}`, actorId, runId);
  }

  const items: DatasetItems = Array.isArray(data) ? (data as DatasetItems) : [];
  if (items.length > 0) return items;

  // Empty dataset — go ask Apify what actually happened on the run.
  let runStatus: string | undefined;
  let statusMessage: string | undefined;
  let exitCode: number | undefined;
  if (runId && token) {
    const runInfo = await fetchJsonSafe(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`) as
      | { data?: { status?: string; statusMessage?: string; exitCode?: number } }
      | null;
    runStatus = runInfo?.data?.status;
    statusMessage = runInfo?.data?.statusMessage;
    exitCode = runInfo?.data?.exitCode;
  }
  const logText = runId && token
    ? await fetchTextSafe(`${APIFY_BASE}/actor-runs/${runId}/log?token=${token}`)
    : null;
  const logTail = logText ? logText.slice(-400).replace(/\s+/g, ' ').trim() : '';

  const inputSummary = summarizeInput(payload);
  const base = `actor=${actorId} run=${runId ?? 'unknown'} status=${runStatus ?? 'unknown'}${
    typeof exitCode === 'number' ? ` exit=${exitCode}` : ''
  } [input: ${inputSummary}]`;
  const detail = statusMessage ? ` msg: ${statusMessage}` : '';
  const tail = logTail ? ` log: …${logTail}` : '';

  if (runStatus && runStatus !== 'SUCCEEDED') {
    throw new ApifyError(`${base}${detail}${tail}`, actorId, runId);
  }
  throw new ApifyEmptyError(
    `Apify run finished SUCCEEDED but returned 0 items. ${base}${detail}${tail}`,
    actorId,
    runId,
    runStatus,
  );
}

/** Used by the apify-probe debug endpoint — never throws, always returns details. */
export async function probeActor(
  actorId: string,
  payload: Record<string, unknown>,
): Promise<{
  ok: boolean;
  itemCount: number;
  sampleItems: DatasetItems;
  runId?: string;
  runStatus?: string;
  statusMessage?: string;
  exitCode?: number;
  logTail?: string;
  error?: string;
}> {
  try {
    const items = await runActorSync(actorId, payload);
    return { ok: true, itemCount: items.length, sampleItems: items.slice(0, 3) };
  } catch (e) {
    if (e instanceof ApifyEmptyError) {
      return {
        ok: false,
        itemCount: 0,
        sampleItems: [],
        runId: e.runId,
        runStatus: e.runStatus,
        error: e.message,
      };
    }
    if (e instanceof ApifyError) {
      return { ok: false, itemCount: 0, sampleItems: [], runId: e.runId, error: e.message };
    }
    return { ok: false, itemCount: 0, sampleItems: [], error: String(e).slice(0, 500) };
  }
}
