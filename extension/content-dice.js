(() => {
  const SOURCE = "dice";
  const sent = new Set();
  function jitter() { return new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); }
  function abs(u) { if (!u) return null; try { return new URL(u, location.origin).toString(); } catch { return null; } }

  function parse() {
    const out = [];
    const cards = document.querySelectorAll('dhi-search-card, div.search-card, a[data-cy="card-title-link"]');
    cards.forEach((node) => {
      const card = node.closest('dhi-search-card, div.search-card') || node;
      const link = card.querySelector('a[data-cy="card-title-link"], a[href*="/job-detail/"]');
      const id = link?.getAttribute('id') || card.getAttribute('id') || null;
      const title = link?.innerText?.trim();
      const company = card.querySelector('a[data-cy="search-result-company-name"], .company-name')?.innerText?.trim();
      const loc = card.querySelector('[data-cy="search-result-location"], .location')?.innerText?.trim();
      const url = abs(link?.getAttribute('href'));
      if (!url || !title || !company) return;
      const key = id || url;
      if (sent.has(key)) return;
      sent.add(key);
      out.push({ source_job_id: id, title, company, location: loc || null, url });
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
