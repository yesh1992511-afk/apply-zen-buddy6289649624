/**
 * Curated company packs for board scrapers. Used by the "Load pack" button on
 * /sources to merge pre-selected company slugs into a source's existing config
 * without overwriting user additions.
 *
 * Adapters supported:
 *   greenhouse_boards / lever_boards / smartrecruiters_boards
 *   recruitee_boards / teamtailor_boards    → field: "companies"
 *   ashby_boards                            → field: "boards"
 *   workable_boards                         → field: "subdomains"
 *   bamboohr_boards / breezyhr_boards
 *   personio_boards / jobvite_boards        → field: "subdomains" / "companies"
 *   workday_boards                          → field: "sites" (host/tenant/site triples)
 *   icims_boards                            → field: "portals" (host/company pairs)
 */
export type PackKey = "cybersecurity" | "tech_top" | "fintech" | "ai_ml" | "healthtech" | "remote_first";

type StringField = string[];
type WorkdaySite = { host: string; tenant: string; site: string };
type ICIMSPortal = { host: string; company: string };

type SourceConfigPatch = {
  greenhouse_boards: StringField;
  lever_boards: StringField;
  ashby_boards: StringField;
  workable_boards: StringField;
  smartrecruiters_boards: StringField;
  recruitee_boards: StringField;
  teamtailor_boards: StringField;
  bamboohr_boards: StringField;
  breezyhr_boards: StringField;
  personio_boards: StringField;
  jobvite_boards: StringField;
  workday_boards: WorkdaySite[];
  icims_boards: ICIMSPortal[];
};

export const PACKS: Record<PackKey, { label: string; description: string; data: Partial<SourceConfigPatch> }> = {
  cybersecurity: {
    label: "Cybersecurity (70+)",
    description: "Companies hiring security engineers, SOC, AppSec, cloud security, pentest.",
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
      workable_boards: ["doctolib", "getyourguide", "omio", "hostaway", "persistent", "trustly"],
      smartrecruiters_boards: ["Visa", "Bosch", "Square", "Ubisoft", "McKesson", "Atos", "Allianz", "Equinix", "PublicisSapient"],
      recruitee_boards: ["catawiki", "miro", "contentful", "dept", "omio"],
      teamtailor_boards: ["voi", "klarna", "polestar", "mentimeter", "kry", "oda"],
      bamboohr_boards: ["arcticwolf", "huntress", "secureframe", "drata"],
      workday_boards: [
        { host: "cisco.wd5.myworkdayjobs.com", tenant: "cisco", site: "external_career_site" },
        { host: "ibm.wd5.myworkdayjobs.com", tenant: "ibm", site: "IBM" },
        { host: "paloaltonetworks.wd5.myworkdayjobs.com", tenant: "paloaltonetworks", site: "PaloAltoNetworks" },
      ],
    },
  },

  tech_top: {
    label: "Top Tech (100+)",
    description: "FAANG, unicorns, and major tech companies across Greenhouse / Lever / Ashby / Workday.",
    data: {
      greenhouse_boards: [
        "airbnb", "stripe", "doordash", "instacart", "coinbase", "robinhood", "plaid",
        "figma", "asana", "discord", "reddit", "pinterest", "snap", "roblox", "duolingo",
        "twilio", "mongodb", "datadog", "snowflake", "gitlab", "hashicorp", "cloudflare",
        "okta", "samsara", "rippling", "ramp", "brex", "webflow", "retool", "airtable",
        "1password", "sentry", "anthropic", "scaleai", "characterai", "mercury",
        "stytch", "thumbtack", "wise", "carta", "checkr", "clearbit",
      ],
      lever_boards: [
        "netflix", "palantir", "spotify", "twitch", "shopify", "kraken", "eventbrite",
        "postman", "applied-intuition", "ringcentral", "lyft", "tinder", "wayfair",
      ],
      ashby_boards: [
        "openai", "linear", "vercel", "posthog", "lattice", "replicate", "watershed",
        "perplexity", "deel", "supabase", "huggingface", "cursor", "elevenlabs",
        "ramp", "retool", "mercury", "character", "gem", "browserbase",
      ],
      workday_boards: [
        { host: "nvidia.wd5.myworkdayjobs.com", tenant: "nvidia", site: "NVIDIAExternalCareerSite" },
        { host: "salesforce.wd1.myworkdayjobs.com", tenant: "salesforce", site: "External_Career_Site" },
        { host: "adobe.wd5.myworkdayjobs.com", tenant: "adobe", site: "external_experienced" },
        { host: "amazon.jobs.com", tenant: "amazon", site: "amazon" },
        { host: "uber.wd5.myworkdayjobs.com", tenant: "uber", site: "UberExternal" },
        { host: "ibm.wd5.myworkdayjobs.com", tenant: "ibm", site: "IBM" },
        { host: "cisco.wd5.myworkdayjobs.com", tenant: "cisco", site: "external_career_site" },
        { host: "vmware.wd1.myworkdayjobs.com", tenant: "vmware", site: "VMware" },
      ],
      smartrecruiters_boards: ["Visa", "Square", "Bosch", "Equinix"],
    },
  },

  fintech: {
    label: "Fintech (25+)",
    description: "Payments, banking, trading, crypto, and insurance companies.",
    data: {
      greenhouse_boards: [
        "stripe", "plaid", "robinhood", "coinbase", "brex", "ramp", "mercury",
        "carta", "wise", "klarna", "affirm", "marqeta", "checkout", "fireblocks",
        "anchorage", "chime", "betterment", "wealthfront",
      ],
      lever_boards: ["kraken", "circle", "blockchain", "binance"],
      ashby_boards: ["mercury", "ramp", "deel"],
      workday_boards: [
        { host: "jpmc.wd5.myworkdayjobs.com", tenant: "jpmc", site: "jpmc" },
        { host: "goldmansachs.wd1.myworkdayjobs.com", tenant: "goldmansachs", site: "external" },
        { host: "morganstanley.wd5.myworkdayjobs.com", tenant: "morganstanley", site: "External" },
      ],
    },
  },

  ai_ml: {
    label: "AI / ML (30+)",
    description: "Foundation model, ML infra, AI tooling companies.",
    data: {
      ashby_boards: [
        "openai", "anthropic", "perplexity", "character", "elevenlabs", "huggingface",
        "replicate", "cursor", "browserbase", "watershed", "linear", "posthog",
      ],
      greenhouse_boards: [
        "scaleai", "anthropic", "characterai", "weights-and-biases", "hugging-face",
        "modal-labs", "together", "runwayml", "midjourney", "stability-ai",
      ],
      lever_boards: ["mistral", "cohere", "inflection", "cresta", "applied-intuition"],
    },
  },

  healthtech: {
    label: "Healthtech (20+)",
    description: "Digital health, telemedicine, clinical platforms, biotech.",
    data: {
      greenhouse_boards: [
        "ro", "hims", "tempus", "color", "modern-health", "lyra-health",
        "headway", "spring-health", "calm", "tia",
      ],
      lever_boards: ["doctolib", "kry"],
      workable_boards: ["doctolib"],
      teamtailor_boards: ["kry"],
      workday_boards: [
        { host: "kaiserpermanente.wd5.myworkdayjobs.com", tenant: "kaiserpermanente", site: "KP" },
      ],
    },
  },

  remote_first: {
    label: "Remote-first (30+)",
    description: "Fully distributed companies hiring globally.",
    data: {
      greenhouse_boards: ["gitlab", "hashicorp", "cloudflare", "automattic", "doist", "buffer", "zapier"],
      lever_boards: ["matterport", "ringcentral"],
      ashby_boards: ["linear", "vercel", "supabase", "posthog", "browserbase", "elevenlabs", "deel"],
      workable_boards: ["hostaway"],
      teamtailor_boards: ["mentimeter", "oda"],
    },
  },
};

type AnyBoardKey = keyof SourceConfigPatch;

const STRING_FIELDS: Record<string, "companies" | "boards" | "subdomains"> = {
  greenhouse_boards: "companies",
  lever_boards: "companies",
  smartrecruiters_boards: "companies",
  recruitee_boards: "companies",
  teamtailor_boards: "companies",
  jobvite_boards: "companies",
  breezyhr_boards: "companies",
  ashby_boards: "boards",
  workable_boards: "subdomains",
  bamboohr_boards: "subdomains",
  personio_boards: "subdomains",
};

const STRUCTURED_FIELDS: Record<string, "sites" | "portals"> = {
  workday_boards: "sites",
  icims_boards: "portals",
};

/** Returns the right config field name for a given board source key. */
export function configFieldFor(sourceKey: string): "companies" | "boards" | "subdomains" | "sites" | "portals" | null {
  return STRING_FIELDS[sourceKey] ?? STRUCTURED_FIELDS[sourceKey] ?? null;
}

/** Merge a curated pack into an existing source config, deduplicated. */
export function mergePackIntoConfig(
  sourceKey: string,
  currentConfig: Record<string, unknown>,
  pack: PackKey,
): { config: Record<string, unknown>; added: number } {
  const field = configFieldFor(sourceKey);
  if (!field) return { config: currentConfig, added: 0 };
  const incoming = (PACKS[pack].data as Record<string, unknown>)[sourceKey];
  if (!incoming) return { config: currentConfig, added: 0 };

  // Structured fields (Workday sites, iCIMS portals) — dedupe by host+tenant or host.
  if (STRUCTURED_FIELDS[sourceKey]) {
    const existing = Array.isArray(currentConfig[field]) ? (currentConfig[field] as Array<Record<string, string>>) : [];
    const seen = new Set(existing.map((x) => `${x.host}|${x.tenant ?? x.company ?? ""}`));
    const merged = [...existing];
    let added = 0;
    for (const item of incoming as Array<Record<string, string>>) {
      const k = `${item.host}|${item.tenant ?? item.company ?? ""}`;
      if (!seen.has(k)) {
        merged.push(item);
        seen.add(k);
        added++;
      }
    }
    return { config: { ...currentConfig, [field]: merged }, added };
  }

  // String fields (Greenhouse, Lever, Ashby, etc.).
  const existing = Array.isArray(currentConfig[field]) ? (currentConfig[field] as string[]) : [];
  const seen = new Set(existing.map((x) => String(x).toLowerCase()));
  const merged = [...existing];
  let added = 0;
  for (const slug of incoming as string[]) {
    if (!seen.has(slug.toLowerCase())) {
      merged.push(slug);
      seen.add(slug.toLowerCase());
      added++;
    }
  }
  return { config: { ...currentConfig, [field]: merged }, added };
}

/** All pack keys, in display order. */
export const PACK_KEYS: PackKey[] = ["tech_top", "ai_ml", "cybersecurity", "fintech", "healthtech", "remote_first"];

// Re-export for callers (sources.tsx) that need the raw type.
export type { AnyBoardKey };
