// JobPilot Capture — background service worker
// Batches captures from content scripts and flushes to the backend.
// Throttle: at most one POST per source every 10s.

const DEFAULT_ENDPOINT = "https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/sources/ingest-extension";

const buffers = {}; // { source: [jobs] }
const lastFlush = {}; // { source: timestamp }
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 50;

async function getConfig() {
  const { token, endpoint, paused } = await chrome.storage.local.get(["token", "endpoint", "paused"]);
  return {
    token: token || "",
    endpoint: endpoint || DEFAULT_ENDPOINT,
    paused: !!paused,
  };
}

async function flush(source) {
  const { token, endpoint, paused } = await getConfig();
  if (paused || !token) return;
  const batch = (buffers[source] || []).splice(0, MAX_BATCH);
  if (!batch.length) return;
  lastFlush[source] = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source, jobs: batch }),
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch {}
    const prev = await chrome.storage.local.get(["stats"]);
    const stats = prev.stats || {};
    const today = new Date().toISOString().slice(0, 10);
    if (!stats[today]) stats[today] = {};
    stats[today][source] = (stats[today][source] || 0) + (json.inserted || 0);
    await chrome.storage.local.set({ stats, lastResponse: { source, ok: res.ok, status: res.status, ts: Date.now(), json } });
  } catch (e) {
    await chrome.storage.local.set({ lastResponse: { source, ok: false, error: String(e), ts: Date.now() } });
    // re-queue the batch
    buffers[source] = batch.concat(buffers[source] || []);
  }
}

function scheduleFlush(source) {
  const since = Date.now() - (lastFlush[source] || 0);
  const delay = Math.max(0, FLUSH_INTERVAL_MS - since);
  setTimeout(() => flush(source), delay + Math.floor(Math.random() * 400));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "capture" && Array.isArray(msg.jobs)) {
    const src = msg.source;
    if (!src) return;
    buffers[src] = (buffers[src] || []).concat(msg.jobs);
    scheduleFlush(src);
    sendResponse({ queued: msg.jobs.length });
    return true;
  }
  if (msg && msg.type === "flush_now") {
    flush(msg.source).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Periodic safety flush every 30s for every active source
setInterval(() => {
  for (const src of Object.keys(buffers)) {
    if ((buffers[src] || []).length) flush(src);
  }
}, 30_000);
