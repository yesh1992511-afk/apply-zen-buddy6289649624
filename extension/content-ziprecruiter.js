(() => {
  const SOURCE = "ziprecruiter";
  const sent = new Set();
  function jitter() { return new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); }
  function abs(u) { if (!u) return null; try { return new URL(u, location.origin).toString(); } catch { return null; } }

  function parse() {
    const out = [];
    const cards = document.querySelectorAll('article.job_result, div.job_content, a.job_link, [data-testid="job-card"]');
    cards.forEach((node) => {
      const card = node.closest('article, div.job_content, [data-testid="job-card"]') || node;
      const link = card.querySelector('a.job_link, h2 a, a[href*="/jobs/"]');
      const title = link?.innerText?.trim() || card.querySelector('h2, [data-testid="job-title"]')?.innerText?.trim();
      const company = card.querySelector('a.t_org_link, .hiring_company, [data-testid="company-name"]')?.innerText?.trim();
      const loc = card.querySelector('.location, [data-testid="job-location"]')?.innerText?.trim();
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
