import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { z } from 'zod';
import { createHash } from 'crypto';

/**
 * Public ingest endpoint called by the browser extension.
 * Auth: Bearer <extension_token> (per-user secret stored in extension_tokens table).
 *
 * Body: { source: "linkedin"|"indeed"|"glassdoor"|"ziprecruiter"|"wellfound"|"dice",
 *         jobs: NormalizedJob[] }
 *
 * No PII is returned. We dedupe by (user_id, dedupe_hash).
 */

const ALLOWED_SOURCES = ['linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'wellfound', 'dice'] as const;

const JobSchema = z.object({
  source_job_id: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(500),
  company: z.string().min(1).max(255),
  location: z.string().max(500).optional().nullable(),
  remote: z.string().max(50).optional().nullable(),
  url: z.string().url().max(2000),
  description: z.string().max(50000).optional().nullable(),
  salary_min: z.number().int().min(0).max(10_000_000).optional().nullable(),
  salary_max: z.number().int().min(0).max(10_000_000).optional().nullable(),
  salary_currency: z.string().max(8).optional().nullable(),
  employment_type: z.string().max(50).optional().nullable(),
  seniority: z.string().max(50).optional().nullable(),
  posted_at: z.string().datetime().optional().nullable(),
});

const BodySchema = z.object({
  source: z.enum(ALLOWED_SOURCES),
  jobs: z.array(JobSchema).min(1).max(100),
});

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

export const Route = createFileRoute('/api/public/sources/ingest-extension')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),

      POST: async ({ request }) => {
        const auth = request.headers.get('authorization') ?? '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        if (!token || token.length < 16) {
          return new Response(JSON.stringify({ error: 'missing_token' }), { status: 401, headers: corsHeaders() });
        }

        const { data: tokenRow, error: tokenErr } = await supabaseAdmin
          .from('extension_tokens')
          .select('id, user_id, last_reset_date, captures_today, captures_total')
          .eq('token', token)
          .maybeSingle();

        if (tokenErr || !tokenRow) {
          return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401, headers: corsHeaders() });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: corsHeaders() });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'invalid_body', details: parsed.error.flatten() }), { status: 400, headers: corsHeaders() });
        }

        const { source, jobs } = parsed.data;
        const source_key = `ext_${source}`;
        const userId = tokenRow.user_id as string;

        const rows = jobs.map((j) => {
          const sjid = j.source_job_id ?? createHash('sha1').update(j.url).digest('hex').slice(0, 32);
          const dedupe = createHash('sha1')
            .update([userId, source_key, sjid, j.title.toLowerCase().trim(), j.company.toLowerCase().trim()].join('|'))
            .digest('hex');
          return {
            user_id: userId,
            source_key,
            source_job_id: sjid,
            dedupe_hash: dedupe,
            title: j.title,
            company: j.company,
            location: j.location ?? null,
            remote: j.remote ?? null,
            url: j.url,
            description: j.description ?? null,
            salary_min: j.salary_min ?? null,
            salary_max: j.salary_max ?? null,
            salary_currency: j.salary_currency ?? null,
            employment_type: j.employment_type ?? null,
            seniority: j.seniority ?? null,
            posted_at: j.posted_at ?? null,
            scraped_at: new Date().toISOString(),
            raw: { via: 'extension', source } as unknown as never,
            status: 'new',
          };
        });

        // Dedupe within batch first
        const seen = new Set<string>();
        const unique = rows.filter((r) => (seen.has(r.dedupe_hash) ? false : (seen.add(r.dedupe_hash), true)));

        // Find which already exist for this user
        const { data: existing } = await supabaseAdmin
          .from('jobs')
          .select('dedupe_hash')
          .eq('user_id', userId)
          .in('dedupe_hash', unique.map((r) => r.dedupe_hash));

        const existingSet = new Set((existing ?? []).map((r) => r.dedupe_hash as string));
        const toInsert = unique.filter((r) => !existingSet.has(r.dedupe_hash));

        let inserted = 0;
        if (toInsert.length) {
          const { data: ins, error: insErr } = await supabaseAdmin
            .from('jobs')
            .insert(toInsert)
            .select('id');
          if (insErr) {
            return new Response(JSON.stringify({ error: 'insert_failed', details: insErr.message }), { status: 500, headers: corsHeaders() });
          }
          inserted = ins?.length ?? 0;

          // Score each new job
          await Promise.all(
            (ins ?? []).map((row) => supabaseAdmin.rpc('match_job_to_filters', { _job_id: row.id }))
          );
        }

        // Update token stats (daily counter resets at UTC midnight)
        const today = new Date().toISOString().slice(0, 10);
        const captures_today =
          tokenRow.last_reset_date === today
            ? (tokenRow.captures_today ?? 0) + inserted
            : inserted;

        await supabaseAdmin
          .from('extension_tokens')
          .update({
            last_seen_at: new Date().toISOString(),
            captures_today,
            captures_total: (tokenRow.captures_total ?? 0) + inserted,
            last_reset_date: today,
          })
          .eq('id', tokenRow.id);

        // Update or insert a "source" row so it shows up in the Sources UI with last-seen
        await supabaseAdmin
          .from('sources')
          .upsert(
            {
              user_id: userId,
              key: source_key,
              display_name: `${source.charAt(0).toUpperCase() + source.slice(1)} (extension)`,
              kind: 'rest',
              enabled: true,
              cadence_minutes: 60,
              config: { via: 'extension' },
              last_run_at: new Date().toISOString(),
              last_run_status: 'succeeded',
              last_run_count: inserted,
            },
            { onConflict: 'user_id,key' }
          );

        return new Response(
          JSON.stringify({ ok: true, received: jobs.length, inserted, duplicates: jobs.length - inserted }),
          { status: 200, headers: corsHeaders() }
        );
      },
    },
  },
});
