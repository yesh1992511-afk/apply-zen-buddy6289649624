// JobPilot Capture — popup
let pollTimer = null;

async function refreshStatus() {
  const s = await chrome.runtime.sendMessage({ type: "status" }).catch(() => null);
  const pendingEl = document.getElementById("pending");
  const qappsEl = document.getElementById("qapps");
  const workerDot = document.getElementById("workerDot");
  const workerLabel = document.getElementById("workerLabel");
  if (!pendingEl) return;
  pendingEl.textContent = s?.pending ?? 0;
  qappsEl.textContent = typeof s?.queued_apps === "number" ? s.queued_apps : "—";
  workerDot.classList.remove("on", "warn");
  if (s?.online) {
    workerDot.classList.add("on");
    workerLabel.textContent = "online";
  } else if (s?.last_seen) {
    workerDot.classList.add("warn");
    const ageMin = Math.round((Date.now() - new Date(s.last_seen).getTime()) / 60000);
    workerLabel.textContent = `stale ${ageMin}m`;
  } else {
    workerLabel.textContent = "offline";
  }
}

async function render() {
  const { token, paused, stats, lastResponse } = await chrome.storage.local.get([
    "token", "paused", "stats", "lastResponse",
  ]);
  const captureDot = document.getElementById("captureDot");
  const status = document.getElementById("status");
  const statsEl = document.getElementById("stats");
  const toggle = document.getElementById("toggle");
  const syncBtn = document.getElementById("sync");

  if (!token) {
    captureDot.classList.remove("on");
    status.innerHTML = 'Not paired. Click <strong>Settings</strong> to paste your pairing token.';
    statsEl.innerHTML = "";
    toggle.style.display = "none";
    syncBtn.style.display = "none";
    return;
  }
  syncBtn.style.display = "";
  toggle.style.display = "";

  if (!paused) captureDot.classList.add("on");
  else captureDot.classList.remove("on");
  status.innerHTML = paused ? "Paused — not capturing." : "Active — capturing as you browse.";

  const today = new Date().toISOString().slice(0, 10);
  const t = (stats && stats[today]) || {};
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  statsEl.innerHTML = `
    <div class="row"><span>Captured today</span><strong>${total}</strong></div>
    ${Object.entries(t).map(([k, v]) => `<div class="row"><span class="muted">${k}</span><span>${v}</span></div>`).join("")}
    ${lastResponse ? `<div class="muted" style="margin-top:8px;">Last sync: ${new Date(lastResponse.ts).toLocaleTimeString()} · ${lastResponse.ok ? "OK" : "Failed: " + (lastResponse.error || lastResponse.status)}</div>` : ""}
  `;
  toggle.textContent = paused ? "Resume capture" : "Pause capture";
  toggle.onclick = async () => {
    await chrome.storage.local.set({ paused: !paused });
    render();
  };
  syncBtn.onclick = async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = "Syncing…";
    await chrome.runtime.sendMessage({ type: "flush_now" });
    await refreshStatus();
    syncBtn.disabled = false;
    syncBtn.textContent = "Sync now";
  };

  await refreshStatus();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshStatus, 10_000);
}

document.getElementById("options").onclick = () => chrome.runtime.openOptionsPage();
window.addEventListener("unload", () => pollTimer && clearInterval(pollTimer));
render();
