/**
 * Curated company packs for board scrapers (Greenhouse / Lever / Ashby / Workable /
 * SmartRecruiters / Recruitee / Teamtailor). Used by the "Load pack" button on /sources
 * to merge into the source's existing config without overwriting user additions.
 */
export type PackKey = "cybersecurity";

type SourceConfigPatch = {
  // Field name used by each board source's config.
  // Greenhouse / Lever / SmartRecruiters / Recruitee → "companies"
  // Ashby → "boards"
  // Workable → "subdomains"
  // Teamtailor → "companies"
  greenhouse_boards: string[];
  lever_boards: string[];
  ashby_boards: string[];
  workable_boards: string[];
  smartrecruiters_boards: string[];
  recruitee_boards: string[];
  teamtailor_boards: string[];
};

export const PACKS: Record<PackKey, { label: string; description: string; data: SourceConfigPatch }> = {
  cybersecurity: {
    label: "Cybersecurity-heavy pack",
    description: "70+ companies known for hiring security engineers, SOC analysts, AppSec, cloud security, and pentesters.",
    data: {
      greenhouse_boards: [
        "cloudflare", "crowdstrike", "datadog", "okta", "snowflake", "gitlab", "hashicorp",
        "doordash", "robinhood", "instacart", "coinbase", "airtable", "asana", "plaid",
        "stripe", "airbnb", "brex", "ramp", "mongodb", "sentry", "anthropic", "discord",
        "figma", "reddit", "rippling", "samsara", "pinterest", "roblox", "duolingo",
        "retool", "webflow", "1password", "duo", "tanium", "rapid7",
      ],
      lever_boards: [
        "netflix", "palantir", "attentive", "postman", "brex", "faire", "cresta",
        "applied-intuition", "anthropic", "twitch", "spotify", "shopify", "kraken",
        "mistral", "eventbrite", "matterport",
      ],
      ashby_boards: [
        "openai", "ramp", "linear", "vercel", "retool", "posthog", "lattice", "replicate",
        "mercury", "watershed", "perplexity", "character", "gem", "deel", "supabase",
        "huggingface", "browserbase", "cursor", "elevenlabs",
      ],
      workable_boards: [
        "doctolib", "getyourguide", "omio", "hostaway", "persistent", "trustly",
      ],
      smartrecruiters_boards: [
        "Visa", "Bosch", "Square", "Ubisoft", "McKesson", "Atos", "Allianz",
        "Equinix", "PublicisSapient",
      ],
      recruitee_boards: [
        "catawiki", "miro", "contentful", "dept", "omio",
      ],
      teamtailor_boards: [
        "voi", "klarna", "polestar", "mentimeter", "kry", "oda",
      ],
    },
  },
};

/** Returns the right config field name for a given board source key. */
export function configFieldFor(sourceKey: string): "companies" | "boards" | "subdomains" | null {
  if (sourceKey === "ashby_boards") return "boards";
  if (sourceKey === "workable_boards") return "subdomains";
  if (
    sourceKey === "greenhouse_boards" ||
    sourceKey === "lever_boards" ||
    sourceKey === "smartrecruiters_boards" ||
    sourceKey === "recruitee_boards" ||
    sourceKey === "teamtailor_boards"
  ) return "companies";
  return null;
}

/** Merge new slugs into an existing config dedup'd. Returns new config object. */
export function mergePackIntoConfig(
  sourceKey: keyof SourceConfigPatch,
  currentConfig: Record<string, unknown>,
  pack: PackKey,
): { config: Record<string, unknown>; added: number } {
  const field = configFieldFor(sourceKey);
  if (!field) return { config: currentConfig, added: 0 };
  const incoming = PACKS[pack].data[sourceKey] ?? [];
  const existing = Array.isArray(currentConfig[field]) ? (currentConfig[field] as string[]) : [];
  const seen = new Set(existing.map((x) => x.toLowerCase()));
  const merged = [...existing];
  let added = 0;
  for (const slug of incoming) {
    if (!seen.has(slug.toLowerCase())) {
      merged.push(slug);
      added++;
    }
  }
  return { config: { ...currentConfig, [field]: merged }, added };
}
