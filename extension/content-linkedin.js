// LinkedIn job capture (read-only, no automation, no clicking)
(() => {
  const SOURCE = "linkedin";
  const sent = new Set();

  function jitter() { return new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); }

  function abs(u) {
    if (!u) return null;
    try { return new URL(u, location.origin).toString(); } catch { return null; }
  }

  function parseCards() {
    const out = [];
    // Search results
    const cards = document.querySelectorAll('[data-job-id], li[data-occludable-job-id], div.job-card-container');
    cards.forEach((card) => {
      const id = card.getAttribute('data-job-id') || card.getAttribute('data-occludable-job-id');
      const titleEl = card.querySelector('a.job-card-list__title, a.job-card-container__link, a[href*="/jobs/view/"]');
      const compEl = card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle, .job-card-container__company-name');
      const locEl = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
      const url = abs(titleEl?.getAttribute('href') || (id ? `/jobs/view/${id}/` : null));
      const title = titleEl?.innerText?.trim();
      const company = compEl?.innerText?.trim();
      if (!url || !title || !company) return;
      const key = id || url;
      if (sent.has(key)) return;
      sent.add(key);
      out.push({
        source_job_id: id || null,
        title,
        company,
        location: locEl?.innerText?.trim() || null,
        url,
      });
    });

    // Job detail pane (when one card is opened)
    const detail = document.querySelector('.jobs-search__job-details--container, .jobs-details');
    if (detail) {
      const t = detail.querySelector('h1, .job-details-jobs-unified-top-card__job-title')?.innerText?.trim();
      const c = detail.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText?.trim();
      const l = detail.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet')?.innerText?.trim();
      const desc = detail.querySelector('#job-details, .jobs-description__content, .jobs-description-content__text')?.innerText?.trim();
      const m = location.pathname.match(/jobs\/view\/(\d+)/);
      const id = m ? m[1] : null;
      const url = id ? `${location.origin}/jobs/view/${id}/` : location.href.split('?')[0];
      const key = id || url;
      if (t && c && !sent.has(key)) {
        sent.add(key);
        out.push({
          source_job_id: id,
          title: t,
          company: c,
          location: l || null,
          description: desc ? desc.slice(0, 20000) : null,
          url,
        });
      }
    }
    return out;
  }

  async function capture() {
    await jitter();
    const jobs = parseCards();
    if (!jobs.length) return;
    chrome.runtime.sendMessage({ type: "capture", source: SOURCE, jobs });
  }

  // Observe DOM for new cards as user scrolls
  const obs = new MutationObserver(() => { capture(); });
  obs.observe(document.body, { childList: true, subtree: true });
  capture();
})();
