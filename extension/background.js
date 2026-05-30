// JobPilot Capture — background service worker (MV3, ES module)
// - Offline outbox in chrome.storage.local with retries + dedupe
// - Flush on online event + 30s alarm + on capture
// - Handles queue-apply and upload-cookies messages from content scripts
// - Encrypts cookies locally before uploading (passphrase stays in browser)

import "./crypto.js";

const BASE = "https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app";
const ENDPOINTS = {
  ingest: `${BASE}/api/public/sources/ingest-extension`,
  queueApply: `${BASE}/api/public/sources/queue-apply`,
  uploadCookies: `${BASE}/api/public/sources/upload-cookies`,
  status: `${BASE}/api/public/sources/worker-status`,
};

const FLUSH_ALARM = "jp-flush";
const MAX_BATCH = 50;
const MAX_BACKOFF_MS = 5 * 60_000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 0.5 });
});

async function getConfig() {
  const c = await chrome.storage.local.get(["token", "endpoint", "paused", "passphrase"]);
  return {
    token: c.token || "",
    endpoint: c.endpoint || ENDPOINTS.ingest,
    paused: !!c.paused,
    passphrase: c.passphrase || "",
  };
}

async function getOutbox() {
  const { outbox } = await chrome.storage.local.get("outbox");
  return outbox || {}; // { source: [{ id, job, attempts, nextAt }] }
}
async function setOutbox(outbox) { await chrome.storage.local.set({ outbox }); }
async function getSent() {
  const { sentUrls } = await chrome.storage.local.get("sentUrls");
  return sentUrls || {}; // { url: ts }
}
async function setSent(sentUrls) { await chrome.storage.local.set({ sentUrls }); }

async function bumpStat(source, count) {
  const { stats } = await chrome.storage.local.get("stats");
  const map = stats || {};
  const today = new Date().toISOString().slice(0, 10);
  if (!map[today]) map[today] = {};
  map[today][source] = (map[today][source] || 0) + count;
  await chrome.storage.local.set({ stats: map });
}

async function enqueue(source, jobs) {
  const outbox = await getOutbox();
  const sent = await getSent();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  // Prune old sent map
  for (const url of Object.keys(sent)) if (sent[url] < cutoff) delete sent[url];

  const fresh = jobs.filter((j) => j && j.url && !sent[j.url]);
  if (!fresh.length) return 0;
  const arr = outbox[source] || [];
  for (const j of fresh) {
    arr.push({ id: crypto.randomUUID(), job: j, attempts: 0, nextAt: 0 });
  }
  outbox[source] = arr;
  await setOutbox(outbox);
  await setSent(sent);
  return fresh.length;
}

async function flushSource(source) {
  const { token, endpoint, paused } = await getConfig();
  if (paused || !token) return { ok: false, reason: "not_configured" };
  const outbox = await getOutbox();
  const queue = outbox[source] || [];
  if (!queue.length) return { ok: true, sent: 0 };
  const now = Date.now();
  const ready = queue.filter((q) => q.nextAt <= now);
  if (!ready.length) return { ok: true, sent: 0 };

  const batch = ready.slice(0, MAX_BATCH);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source, jobs: batch.map((b) => b.job) }),
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* noop */ }
    if (!res.ok) throw new Error(json.error || `http_${res.status}`);

    // Remove batch from queue, mark URLs as sent
    const sentMap = await getSent();
    for (const b of batch) sentMap[b.job.url] = Date.now();
    await setSent(sentMap);
    const remaining = queue.filter((q) => !batch.some((b) => b.id === q.id));
    outbox[source] = remaining;
    await setOutbox(outbox);

    await bumpStat(source, json.inserted || 0);
    await chrome.storage.local.set({
      lastResponse: { source, ok: true, status: res.status, ts: Date.now(), json },
    });
    return { ok: true, sent: batch.length, inserted: json.inserted || 0 };
  } catch (e) {
    // Backoff with exponential delay
    for (const b of batch) {
      b.attempts = (b.attempts || 0) + 1;
      const delay = Math.min(MAX_BACKOFF_MS, 5_000 * Math.pow(2, b.attempts - 1));
      b.nextAt = Date.now() + delay;
    }
    outbox[source] = queue;
    await setOutbox(outbox);
    await chrome.storage.local.set({
      lastResponse: { source, ok: false, error: String(e), ts: Date.now() },
    });
    return { ok: false, reason: String(e) };
  }
}

async function flushAll() {
  const outbox = await getOutbox();
  const results = {};
  for (const src of Object.keys(outbox)) {
    if ((outbox[src] || []).length) results[src] = await flushSource(src);
  }
  return results;
}

async function queueApply(job) {
  const { token } = await getConfig();
  if (!token) return { ok: false, reason: "not_configured" };
  const res = await fetch(ENDPOINTS.queueApply, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ job }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, ...json };
}

async function uploadCookies(host, cookies) {
  const { token, passphrase } = await getConfig();
  if (!token) return { ok: false, reason: "not_configured" };
  if (!passphrase || passphrase.length < 8) return { ok: false, reason: "no_passphrase" };
  if (!self.jpEncrypt) return { ok: false, reason: "crypto_unavailable" };
  const { ciphertext, iv } = await self.jpEncrypt({ host, cookies, captured_at: Date.now() }, passphrase);
  const res = await fetch(ENDPOINTS.uploadCookies, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      host,
      ciphertext,
      iv,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, ...json };
}

async function fetchWorkerStatus() {
  const { token } = await getConfig();
  if (!token) return { online: false, queued_apps: 0 };
  try {
    const res = await fetch(ENDPOINTS.status, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { online: false, queued_apps: 0 };
    return await res.json();
  } catch {
    return { online: false, queued_apps: 0 };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (!msg) return sendResponse({ ok: false });
    if (msg.type === "capture" && Array.isArray(msg.jobs)) {
      const queued = await enqueue(msg.source, msg.jobs);
      // Best-effort immediate flush; failures fall back to alarm.
      flushSource(msg.source).catch(() => {});
      return sendResponse({ queued });
    }
    if (msg.type === "flush_now") {
      const r = await flushAll();
      return sendResponse({ ok: true, results: r });
    }
    if (msg.type === "queue_apply" && msg.job) {
      const r = await queueApply(msg.job);
      return sendResponse(r);
    }
    if (msg.type === "upload_cookies" && msg.host && Array.isArray(msg.cookies)) {
      const r = await uploadCookies(msg.host, msg.cookies);
      return sendResponse(r);
    }
    if (msg.type === "status") {
      const s = await fetchWorkerStatus();
      const outbox = await getOutbox();
      const pending = Object.values(outbox).reduce((n, arr) => n + (arr || []).length, 0);
      return sendResponse({ ...s, pending });
    }
    sendResponse({ ok: false, reason: "unknown_message" });
  })();
  return true; // async
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) flushAll().catch(() => {});
});

// Best-effort online listener (SW gets one event per wake)
self.addEventListener?.("online", () => flushAll().catch(() => {}));
