async function render() {
  const { token, paused, stats, lastResponse } = await chrome.storage.local.get(["token", "paused", "stats", "lastResponse"]);
  const dot = document.getElementById("dot");
  const status = document.getElementById("status");
  const statsEl = document.getElementById("stats");
  const toggle = document.getElementById("toggle");

  if (!token) {
    dot.classList.add("off");
    status.innerHTML = 'Not paired. Click <strong>Settings</strong> below to paste your pairing token.';
    statsEl.innerHTML = "";
    toggle.style.display = "none";
    return;
  }
  if (paused) dot.classList.add("off");
  status.innerHTML = paused ? "Paused — not capturing." : "Active — capturing as you browse.";

  const today = new Date().toISOString().slice(0, 10);
  const t = (stats && stats[today]) || {};
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  statsEl.innerHTML = `
    <div class="row"><span>Captured today</span><strong>${total}</strong></div>
    ${Object.entries(t).map(([k, v]) => `<div class="row"><span class="muted">${k}</span><span>${v}</span></div>`).join("")}
    ${lastResponse ? `<div class="muted" style="margin-top:8px;">Last sync: ${new Date(lastResponse.ts).toLocaleTimeString()} · ${lastResponse.ok ? "OK" : "Failed"}</div>` : ""}
  `;
  toggle.textContent = paused ? "Resume capture" : "Pause capture";
  toggle.onclick = async () => {
    await chrome.storage.local.set({ paused: !paused });
    render();
  };
}
document.getElementById("options").onclick = () => chrome.runtime.openOptionsPage();
render();
