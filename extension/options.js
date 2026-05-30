const DEFAULT_ENDPOINT = "https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/sources/ingest-extension";

async function load() {
  const c = await chrome.storage.local.get(["token", "endpoint", "passphrase", "cookieSyncEnabled"]);
  document.getElementById("token").value = c.token || "";
  document.getElementById("endpoint").value = c.endpoint || DEFAULT_ENDPOINT;
  document.getElementById("passphrase").value = c.passphrase || "";
  document.getElementById("cookieSync").checked = !!c.cookieSyncEnabled;
}

document.getElementById("save").onclick = async () => {
  const msg = document.getElementById("msg");
  const token = document.getElementById("token").value.trim();
  const endpoint = document.getElementById("endpoint").value.trim() || DEFAULT_ENDPOINT;
  const passphrase = document.getElementById("passphrase").value;
  const cookieSyncEnabled = document.getElementById("cookieSync").checked;

  if (cookieSyncEnabled && passphrase.length < 8) {
    msg.textContent = "Passphrase must be at least 8 characters when cookie sync is enabled.";
    msg.className = "err";
    return;
  }

  await chrome.storage.local.set({ token, endpoint, paused: false, passphrase, cookieSyncEnabled });
  msg.textContent = "Saved. Visit a supported job site to start capturing.";
  msg.className = "ok";
};

load();
