const DEFAULT_ENDPOINT = "https://project--ba5780a8-641e-4ee8-9c24-6e1c185cef2f.lovable.app/api/public/sources/ingest-extension";

async function load() {
  const { token, endpoint } = await chrome.storage.local.get(["token", "endpoint"]);
  document.getElementById("token").value = token || "";
  document.getElementById("endpoint").value = endpoint || DEFAULT_ENDPOINT;
}

document.getElementById("save").onclick = async () => {
  const token = document.getElementById("token").value.trim();
  const endpoint = document.getElementById("endpoint").value.trim() || DEFAULT_ENDPOINT;
  await chrome.storage.local.set({ token, endpoint, paused: false });
  const msg = document.getElementById("msg");
  msg.textContent = "Saved. Visit a supported job site to start capturing.";
  msg.className = "ok";
};

load();
