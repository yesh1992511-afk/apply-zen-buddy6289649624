/**
 * Debug probe for Apify-backed sources.
 *
 * GET /api/public/sources/apify-probe?source=apify:linkedin&user_id=<uuid>
 * Headers: x-internal-secret: <WORKER_CRON_SECRET>
 *
 * Calls the same adapter the cron uses, but instead of upserting jobs it
 * returns the raw Apify run summary + the first 3 dataset items + the run
 * log tail. Lets us answer "why 0 results?" in a single curl, without
 * shipping new code, every time an actor's input schema drifts.
 */
import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { hasCronSecret } from '@/lib/api-auth.server';
import { runSource, ApifyEmptyError } from '@/lib/sources/adapters.server';

const VALID = new Set([
  'apify:linkedin',
  'apify:indeed',
  'apify:glassdoor',
  'apify:ziprecruiter',
  'apify:wellfound',
  'apify:google_jobs',
]);

export const Route = createFileRoute('/api/public/sources/apify-probe')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!hasCronSecret(request)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const url = new URL(request.url);
        const source = url.searchParams.get('source') ?? '';
        const userId = url.searchParams.get('user_id') ?? '';
        if (!VALID.has(source)) {
          return Response.json({ error: `source must be one of: ${[...VALID].join(', ')}` }, { status: 400 });
        }
        if (!userId) {
          return Response.json({ error: 'user_id required' }, { status: 400 });
        }

        const { data: s } = await supabaseAdmin
          .from('automation_settings')
          .select('target_titles, target_locations')
          .eq('user_id', userId)
          .maybeSingle();
        const ctx = {
          queries: (s?.target_titles ?? []).filter((q: string) => q?.trim?.()),
          locations: (s?.target_locations ?? []).filter((l: string) => l?.trim?.()),
        };

        const startedAt = Date.now();
        try {
          const jobs = await runSource({ provider: source }, ctx);
          return Response.json({
            ok: true,
            source,
            ctx,
            durationMs: Date.now() - startedAt,
            itemCount: jobs.length,
            sample: jobs.slice(0, 3).map((j) => ({
              title: j.title,
              company: j.company,
              location: j.location,
              url: j.url,
              posted_at: j.posted_at,
              description_preview: j.description?.slice(0, 200) ?? null,
            })),
          });
        } catch (e) {
          const empty = e instanceof ApifyEmptyError;
          return Response.json({
            ok: false,
            source,
            ctx,
            durationMs: Date.now() - startedAt,
            kind: empty ? 'apify_empty' : 'apify_error',
            error: String((e as Error)?.message ?? e).slice(0, 2000),
          }, { status: empty ? 200 : 500 });
        }
      },
    },
  },
});
