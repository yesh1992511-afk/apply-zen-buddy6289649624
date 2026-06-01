/**
 * Universal description normalizer for every source adapter.
 *
 * Goal: every job row stored in `jobs` has a clean `description` (plain text,
 * readable) and a clean `description_html` (real HTML or null) — never
 * entity-encoded HTML like `&lt;div&gt;...`, never a mix.
 *
 * Adapters used to do this inconsistently per source, so Greenhouse was
 * fixed but LinkedIn / Workable / Recruitee / etc. could still leak raw
 * markup or escaped entities into the UI. This module centralizes the rule.
 */

const NAMED_ENTITIES: Record<string, string> = {
  lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
};

/** Decode HTML entities (named + numeric) without using the DOM. Safe in Worker runtime. */
export function decodeHtmlEntities(str: string): string {
  if (!str || str.indexOf('&') === -1) return str;
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const n = parseInt(h, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const n = parseInt(d, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m));
}

/** Strip HTML tags, collapse whitespace. Input should already be entity-decoded. */
export function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const MAX_DESC_CHARS = 8000;

/**
 * Normalize a free-form description from any source into a `{description,
 * description_html}` pair safe to store in `jobs`.
 *
 * Accepts: raw HTML, entity-encoded HTML (`&lt;p&gt;...`), plain text, null,
 * undefined, or a non-string value.
 *
 * Guarantees:
 *  - both fields are either a non-empty string or null
 *  - `description` is plain text (no tags, no entities)
 *  - `description_html` is real HTML (no `&lt;`), or null when the source
 *    only had plain text
 */
export function normalizeDescription(
  input: unknown,
): { description: string | null; description_html: string | null } {
  if (input === null || input === undefined) return { description: null, description_html: null };
  const raw = typeof input === 'string' ? input : String(input);
  if (!raw.trim()) return { description: null, description_html: null };

  const decoded = decodeHtmlEntities(raw).trim();
  const hasTags = /<[a-z!\/][^>]*>/i.test(decoded);

  if (!hasTags) {
    const text = decoded.replace(/\s+/g, ' ').trim();
    return {
      description: text ? text.slice(0, MAX_DESC_CHARS) : null,
      description_html: null,
    };
  }

  const text = stripTags(decoded);
  return {
    description: text ? text.slice(0, MAX_DESC_CHARS) : null,
    description_html: decoded,
  };
}
