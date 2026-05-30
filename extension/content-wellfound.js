(() => {
  const SOURCE = "wellfound";
  const sent = new Set();
  function jitter() { return new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); }
  function abs(u) { if (!u) return null; try { return new URL(u, location.origin).toString(); } catch { return null; } }

  function parse() {
    const out = [];
    const cards = document.querySelectorAll('a[href*="/jobs/"], div[data-test="JobSearchCard"], article');
    cards.forEach((node) => {
      const card = node.closest('div[data-test="JobSearchCard"], article') || node;
      const link = card.querySelector('a[href*="/jobs/"]') || (node.tagName === 'A' ? node : null);
      const title = link?.innerText?.trim() || card.querySelector('h2, h3')?.innerText?.trim();
      const company = card.querySelector('a[href*="/company/"], [data-test="StartupName"]')?.innerText?.trim();
      const loc = card.querySelector('[data-test="Location"], .location')?.innerText?.trim();
      const url = abs(link?.getAttribute('href'));
      if (!url || !title || !company) return;
      const key = url;
      if (sent.has(key)) return;
      sent.add(key);
      out.push({ title, company, location: loc || null, url });
    });
    return out;
  }

  async function capture() {
    await jitter();
    const jobs = parse();
    if (jobs.length) chrome.runtime.sendMessage({ type: "capture", source: SOURCE, jobs });
  }
  new MutationObserver(() => capture()).observe(document.body, { childList: true, subtree: true });
  capture();
})();
