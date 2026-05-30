// Cookie pipe (opt-in): every 12h reads document.cookie for the current host,
// asks the background worker to encrypt & upload. Background owns the passphrase
// and the crypto helper; plaintext cookies never traverse network in cleartext.

(function () {
  if (window.__jpCookiesMounted) return;
  window.__jpCookiesMounted = true;

  const HOST = location.hostname.replace(/^www\./, "").split(".").slice(-2).join(".");

  async function maybeUpload() {
    try {
      const cfg = await chrome.storage.local.get(["cookieSyncEnabled", "lastCookieUpload"]);
      if (!cfg.cookieSyncEnabled) return;
      const last = (cfg.lastCookieUpload || {})[HOST] || 0;
      if (Date.now() - last < 12 * 60 * 60 * 1000) return;

      // Parse document.cookie into { name, value } pairs. Only httpOnly=false
      // cookies are visible here; that's enough for most ATS portals' SPA tokens.
      const pairs = document.cookie.split(";").map((c) => c.trim()).filter(Boolean).map((c) => {
        const idx = c.indexOf("=");
        return { name: c.slice(0, idx), value: c.slice(idx + 1), domain: "." + HOST, path: "/" };
      });
      if (!pairs.length) return;

      const res = await chrome.runtime.sendMessage({ type: "upload_cookies", host: HOST, cookies: pairs });
      if (res && res.ok) {
        const stamp = cfg.lastCookieUpload || {};
        stamp[HOST] = Date.now();
        await chrome.storage.local.set({ lastCookieUpload: stamp });
      }
    } catch {
      /* swallow */
    }
  }

  // Run shortly after load so the user's session is settled
  setTimeout(maybeUpload, 8_000);
})();
