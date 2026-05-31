/**
 * Curated seed list of ATS slugs — biased toward companies that regularly
 * post cybersecurity / security engineering roles. Users can add more from
 * the Sources UI for non-security searches.
 */
export const SEED_SLUGS: Array<{ provider: string; slug: string; display: string }> = [
  // ============================================================
  // Greenhouse — security-heavy hirers
  // ============================================================
  { provider: 'greenhouse', slug: 'crowdstrike', display: 'CrowdStrike' },
  { provider: 'greenhouse', slug: 'sentinelone', display: 'SentinelOne' },
  { provider: 'greenhouse', slug: 'snyk', display: 'Snyk' },
  { provider: 'greenhouse', slug: 'cloudflare', display: 'Cloudflare' },
  { provider: 'greenhouse', slug: 'okta', display: 'Okta' },
  { provider: 'greenhouse', slug: 'hashicorp', display: 'HashiCorp' },
  { provider: 'greenhouse', slug: 'datadog', display: 'Datadog' },
  { provider: 'greenhouse', slug: 'pagerduty', display: 'PagerDuty' },
  { provider: 'greenhouse', slug: 'gitlab', display: 'GitLab' },
  { provider: 'greenhouse', slug: 'elastic', display: 'Elastic' },
  { provider: 'greenhouse', slug: 'splunk', display: 'Splunk' },
  { provider: 'greenhouse', slug: 'chainalysis', display: 'Chainalysis' },
  { provider: 'greenhouse', slug: 'coinbase', display: 'Coinbase' },
  { provider: 'greenhouse', slug: 'stripe', display: 'Stripe' },
  { provider: 'greenhouse', slug: 'plaid', display: 'Plaid' },
  { provider: 'greenhouse', slug: 'sentry', display: 'Sentry' },
  { provider: 'greenhouse', slug: 'jfrog', display: 'JFrog' },
  { provider: 'greenhouse', slug: 'tailscale', display: 'Tailscale' },
  { provider: 'greenhouse', slug: 'vercel', display: 'Vercel' },
  { provider: 'greenhouse', slug: 'segment', display: 'Segment' },
  { provider: 'greenhouse', slug: 'twilio', display: 'Twilio' },
  { provider: 'greenhouse', slug: 'reddit', display: 'Reddit' },
  { provider: 'greenhouse', slug: 'discord', display: 'Discord' },
  { provider: 'greenhouse', slug: 'robinhood', display: 'Robinhood' },
  { provider: 'greenhouse', slug: 'mercury', display: 'Mercury' },
  { provider: 'greenhouse', slug: 'brex', display: 'Brex' },
  { provider: 'greenhouse', slug: 'ramp', display: 'Ramp' },
  { provider: 'greenhouse', slug: 'rippling', display: 'Rippling' },
  { provider: 'greenhouse', slug: 'square', display: 'Block / Square' },
  { provider: 'greenhouse', slug: 'doordash', display: 'DoorDash' },
  { provider: 'greenhouse', slug: 'instacart', display: 'Instacart' },
  { provider: 'greenhouse', slug: 'pinterest', display: 'Pinterest' },
  { provider: 'greenhouse', slug: 'samsara', display: 'Samsara' },
  { provider: 'greenhouse', slug: 'snowflake', display: 'Snowflake' },
  { provider: 'greenhouse', slug: 'databricks', display: 'Databricks' },
  { provider: 'greenhouse', slug: 'confluent', display: 'Confluent' },
  { provider: 'greenhouse', slug: 'grafanalabs', display: 'Grafana Labs' },
  { provider: 'greenhouse', slug: 'newrelic', display: 'New Relic' },
  { provider: 'greenhouse', slug: 'honeycomb', display: 'Honeycomb' },
  { provider: 'greenhouse', slug: 'docker', display: 'Docker' },
  { provider: 'greenhouse', slug: 'salesforce', display: 'Salesforce' },
  { provider: 'greenhouse', slug: 'box', display: 'Box' },
  { provider: 'greenhouse', slug: 'tesla', display: 'Tesla' },

  // ============================================================
  // Lever — security & infra
  // ============================================================
  { provider: 'lever', slug: 'rapid7', display: 'Rapid7' },
  { provider: 'lever', slug: 'palantir', display: 'Palantir' },
  { provider: 'lever', slug: 'netflix', display: 'Netflix' },
  { provider: 'lever', slug: 'spotify', display: 'Spotify' },
  { provider: 'lever', slug: 'shopify', display: 'Shopify' },
  { provider: 'lever', slug: 'kraken', display: 'Kraken' },
  { provider: 'lever', slug: 'deel', display: 'Deel' },
  { provider: 'lever', slug: 'remote', display: 'Remote' },
  { provider: 'lever', slug: 'kandji', display: 'Kandji' },
  { provider: 'lever', slug: 'oscar', display: 'Oscar Health' },

  // ============================================================
  // Ashby — devtools & AI labs (some have security teams)
  // ============================================================
  { provider: 'ashby', slug: 'openai', display: 'OpenAI' },
  { provider: 'ashby', slug: 'linear', display: 'Linear' },
  { provider: 'ashby', slug: 'supabase', display: 'Supabase' },
  { provider: 'ashby', slug: 'vercel', display: 'Vercel (Ashby)' },
  { provider: 'ashby', slug: 'huggingface', display: 'Hugging Face' },
  { provider: 'ashby', slug: 'perplexity', display: 'Perplexity' },
  { provider: 'ashby', slug: 'modal', display: 'Modal' },

  // ============================================================
  // Workable (kept minimal)
  // ============================================================
  { provider: 'workable', slug: 'doist', display: 'Doist' },

  // ============================================================
  // SmartRecruiters (kept minimal)
  // ============================================================
  { provider: 'smartrecruiters', slug: 'Visa', display: 'Visa' },
  { provider: 'smartrecruiters', slug: 'Equinix', display: 'Equinix' },
];
