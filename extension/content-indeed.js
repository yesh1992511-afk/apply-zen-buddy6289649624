(() => {
  const SOURCE = "indeed";
  const sent = new Set();
  function jitter() { return new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); }
  function abs(u) { if (!u) return null; try { return new URL(u, location.origin).toString(); } catch { return null; } }

  function parse() {
    const out = [];
    const cards = document.querySelectorAll('a.tapItem, div.job_seen_beacon, td.resultContent, a[data-jk], h2.jobTitle a');
    cards.forEach((node) => {
      const card = node.closest('div.job_seen_beacon, td.resultContent, li') || node;
      const link = card.querySelector('h2.jobTitle a, a[data-jk]') || (node.tagName === 'A' ? node : null);
      const jk = link?.getAttribute('data-jk') || (link?.href && new URL(link.href, location.origin).searchParams.get('jk'));
      const title = link?.innerText?.trim() || card.querySelector('h2.jobTitle')?.innerText?.trim();
      const company = card.querySelector('[data-testid="company-name"], span.companyName, .companyName')?.innerText?.trim();
      const loc = card.querySelector('[data-testid="text-location"], div.companyLocation')?.innerText?.trim();
      const url = abs(link?.getAttribute('href')) || (jk ? `${location.origin}/viewjob?jk=${jk}` : null);
      if (!url || !title || !company) return;
      const key = jk || url;
      if (sent.has(key)) return;
      sent.add(key);
      out.push({ source_job_id: jk || null, title, company, location: loc || null, url });
    });

    const pane = document.querySelector('#jobsearch-ViewjobPaneWrapper, .jobsearch-ViewJobLayout--standalone, .jobsearch-JobComponent');
    if (pane) {
      const t = pane.querySelector('h1, [data-testid="jobsearch-JobInfoHeader-title"]')?.innerText?.trim();
      const c = pane.querySelector('[data-testid="inlineHeader-companyName"], [data-company-name]')?.innerText?.trim();
      const l = pane.querySelector('[data-testid="inlineHeader-companyLocation"], [data-testid="jobsearch-JobInfoHeader-companyLocation"]')?.innerText?.trim();
      const desc = pane.querySelector('#jobDescriptionText')?.innerText?.trim();
      const jk = new URL(location.href).searchParams.get('jk') || new URL(location.href).searchParams.get('vjk');
      const url = jk ? `${location.origin}/viewjob?jk=${jk}` : location.href.split('&')[0];
      const key = jk || url;
      if (t && c && !sent.has(key)) {
        sent.add(key);
        out.push({ source_job_id: jk, title: t, company: c, location: l || null, description: desc ? desc.slice(0, 20000) : null, url });
      }
    }
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
