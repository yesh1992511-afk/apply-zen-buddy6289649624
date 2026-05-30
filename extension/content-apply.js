// Floating "Apply via JobPilot" button injected on job pages of supported sites.
// Detects basic job metadata from the page and POSTs to /queue-apply.

(function () {
  if (window.__jpApplyMounted) return;
  window.__jpApplyMounted = true;

  const HOST = location.hostname;
  let SOURCE = "generic";
  if (HOST.includes("linkedin.com")) SOURCE = "linkedin";
  else if (HOST.includes("indeed.com")) SOURCE = "indeed";
  else if (HOST.includes("glassdoor.com")) SOURCE = "glassdoor";
  else if (HOST.includes("ziprecruiter.com")) SOURCE = "ziprecruiter";
  else if (HOST.includes("wellfound.com")) SOURCE = "wellfound";
  else if (HOST.includes("dice.com")) SOURCE = "dice";

  function pickText(...selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    return "";
  }

  function detectJob() {
    const title =
      pickText("h1.job-details-jobs-unified-top-card__job-title", "h1.jobsearch-JobInfoHeader-title", "h1[data-test='job-title']", "h1[data-testid='jobDetailsSectionHeaderJobTitle']", "h1.styles_jobTitle__*", "h1") ||
      document.title;
    const company =
      pickText(".job-details-jobs-unified-top-card__company-name a", ".jobsearch-CompanyInfoContainer a", "[data-test='employer-name']", "[data-testid='inlineHeader-companyName']", ".companyName") ||
      "Unknown";
    const location =
      pickText(".job-details-jobs-unified-top-card__bullet", "[data-testid='inlineHeader-companyLocation']", "[data-test='location']") || null;
    const description =
      pickText("#job-details", ".jobsearch-jobDescriptionText", "[data-testid='jobsearch-JobComponent-description']", ".description__text") || null;
    return {
      title: title.slice(0, 500),
      company: company.slice(0, 255),
      url: window.location.href,
      location: location ? location.slice(0, 500) : null,
      description: description ? description.slice(0, 50_000) : null,
      source: SOURCE,
    };
  }

  function mountButton() {
    if (document.getElementById("jp-apply-fab")) return;
    const btn = document.createElement("button");
    btn.id = "jp-apply-fab";
    btn.textContent = "Apply via JobPilot";
    Object.assign(btn.style, {
      position: "fixed", right: "20px", bottom: "20px", zIndex: "2147483647",
      padding: "10px 16px", borderRadius: "999px", border: "0",
      background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize: "13px", fontWeight: "600", cursor: "pointer",
      boxShadow: "0 8px 24px rgba(16,185,129,0.35)",
    });
    btn.addEventListener("click", async () => {
      const job = detectJob();
      job.url = window.location.href;
      btn.disabled = true;
      btn.textContent = "Queuing…";
      try {
        const res = await chrome.runtime.sendMessage({ type: "queue_apply", job });
        if (res && res.ok) {
          btn.textContent = res.already ? "Already queued" : "Queued ✓";
          btn.style.background = "#059669";
        } else {
          btn.textContent = "Failed — retry";
          btn.style.background = "#dc2626";
        }
      } catch (e) {
        btn.textContent = "Failed — retry";
        btn.style.background = "#dc2626";
      }
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Apply via JobPilot";
        btn.style.background = "linear-gradient(135deg,#10b981,#059669)";
      }, 3500);
    });
    document.body.appendChild(btn);
  }

  if (document.body) mountButton();
  else document.addEventListener("DOMContentLoaded", mountButton);
  // Re-mount on SPA navigations (LinkedIn, Wellfound)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const old = document.getElementById("jp-apply-fab");
      if (old) old.remove();
      mountButton();
    }
  }, 1500);
})();
