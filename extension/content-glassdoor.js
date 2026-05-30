(() => {
  const SOURCE = "glassdoor";
  const sent = new Set();
  function jitter() { return new Promise((r) => setTimeout(r, 200 + Math.random() * 600)); }
  function abs(u) { if (!u) return null; try { return new URL(u, location.origin).toString(); } catch { return null; } }

  function parse() {
    const out = [];
    const cards = document.querySelectorAll('li[data-test="jobListing"], div.react-job-listing, a[data-test="job-link"]');
    cards.forEach((node) => {
      const card = node.closest('li[data-test="jobListing"]') || node;
      const link = card.querySelector('a[data-test="job-link"], a.JobCard_jobTitle__rbjTE, a[href*="/job-listing/"]');
      const id = card.getAttribute('data-id') || link?.getAttribute('data-job-id') || null;
      const title = link?.innerText?.trim() || card.querySelector('[data-test="job-title"]')?.innerText?.trim();
      const company = card.querySelector('[data-test="employer-short-name"], [data-test="employer-name"], .EmployerProfile_employerName__Xemli')?.innerText?.trim();
      const loc = card.querySelector('[data-test="emp-location"], [data-test="job-location"]')?.innerText?.trim();
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
