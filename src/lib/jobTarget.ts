/**
 * Job Target — a single place to define what jobs the user wants.
 * Applied across every source's config + the default filter.
 *
 * Worker uses a unified config schema:
 *   { queries: string[], locations: string[], rows: int, remote: bool }
 * Exceptions: remoteok → `tags`, usajobs → `keyword`+`location`,
 * weworkremotely/arbeitnow/ATS boards → no keyword params (left untouched).
 */

export type JobTarget = {
  field: string;                   // preset key, "custom" allowed
  titles: string[];                // search keywords/titles
  locations: string[];             // e.g. ["United States"]
  country: string;                 // e.g. "US"
  postedWithinHours: number;       // 24 / 168 / 720
  excludeKeywords: string[];
};

export type JobTargetPreset = Omit<JobTarget, "field"> & { field: string; label: string };

export const JOB_TARGET_PRESETS: JobTargetPreset[] = [
  {
    field: "cybersecurity",
    label: "Cybersecurity",
    titles: [
      "cybersecurity", "security engineer", "security analyst", "SOC analyst",
      "penetration tester", "pentester", "application security", "appsec",
      "cloud security", "IAM", "GRC", "SIEM", "incident response",
      "threat intelligence", "vulnerability", "red team", "blue team",
      "security architect", "DevSecOps", "information security",
    ],
    locations: ["United States"],
    country: "US",
    postedWithinHours: 168,
    excludeKeywords: [
      "sales", "marketing", "recruiter", "intern", "physical security",
      "security guard", "janitor", "armed", "patrol officer",
    ],
  },
  {
    field: "software",
    label: "Software Engineering",
    titles: ["software engineer", "backend engineer", "frontend engineer", "full stack engineer"],
    locations: ["United States"],
    country: "US",
    postedWithinHours: 168,
    excludeKeywords: ["recruiter", "intern", "sales"],
  },
  {
    field: "data_ml",
    label: "Data / ML",
    titles: ["data engineer", "data scientist", "machine learning engineer", "ML engineer", "MLOps"],
    locations: ["United States"],
    country: "US",
    postedWithinHours: 168,
    excludeKeywords: ["recruiter", "intern", "sales"],
  },
  {
    field: "product",
    label: "Product",
    titles: ["product manager", "senior product manager", "product owner"],
    locations: ["United States"],
    country: "US",
    postedWithinHours: 168,
    excludeKeywords: ["recruiter", "intern"],
  },
  {
    field: "marketing",
    label: "Marketing",
    titles: ["marketing manager", "growth marketer", "content marketing", "performance marketing"],
    locations: ["United States"],
    country: "US",
    postedWithinHours: 168,
    excludeKeywords: ["recruiter", "intern"],
  },
  {
    field: "sales",
    label: "Sales",
    titles: ["account executive", "sales development representative", "SDR", "BDR", "enterprise sales"],
    locations: ["United States"],
    country: "US",
    postedWithinHours: 168,
    excludeKeywords: ["recruiter", "intern"],
  },
];

/**
 * Map a Job Target into the per-source config JSON. Preserves unrelated
 * keys (actor_id, companies, subdomains, api_keys, maxItems aliases…).
 */
export function applyTargetToSourceConfig(
  sourceKey: string,
  current: Record<string, unknown>,
  target: JobTarget,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = { ...current };
  const titles = target.titles;
  const firstTitle = titles[0] ?? "";

  // Unified worker schema covers everything except a few specials
  const standardKey = !["remoteok", "usajobs", "weworkremotely", "arbeitnow"].includes(sourceKey)
    && !sourceKey.endsWith("_boards");

  if (standardKey) {
    cfg.queries = titles;
    cfg.locations = target.locations;
    if (cfg.rows == null) cfg.rows = 50;
  }

  if (sourceKey === "remoteok") {
    // RemoteOK matches on tags — use short, single-word tags
    cfg.tags = titles
      .flatMap((t) => t.toLowerCase().split(/[\s/]+/))
      .filter((t) => t.length >= 3 && t.length <= 24);
  }
  if (sourceKey === "usajobs") {
    cfg.keyword = firstTitle;
    cfg.location = target.locations[0] ?? "";
  }
  // weworkremotely, arbeitnow, *_boards: leave alone (no keyword param)

  return cfg;
}

export function findPreset(field: string): JobTargetPreset | undefined {
  return JOB_TARGET_PRESETS.find((p) => p.field === field);
}
