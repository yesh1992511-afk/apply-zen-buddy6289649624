/**
 * One-shot batch runner.
 *
 * POST /api/public/sources/run-batch
 *   { userId: uuid, target: number (1..50) }
 *
 * Loops aggregator sources serially. After each source:
 *   - upserts normalized jobs
 *   - calls match_job_to_filters for each new row
 *   - counts how many newly inserted rows ended up matched=true
 * Stops as soon as the cumulative inserted-matched count reaches `target`,
 * or when sources are exhausted.
 *
 * The existing `auto_queue_matched_job` trigger queues an `applications` row
 * for each newly matched job (when automation_settings.enabled = true).
 * The pg_cron apply worker then submits them — this route does not apply.
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { hasCronSecret } from '@/lib/api-auth.server';
import {
  runSource,
  AGGREGATOR_PROVIDERS,
  APIFY_PROVIDERS,
  USAJOBS_QUERIES,
  type NormalizedJob,
} from '@/lib/sources/adapters.server';

const BodySchema = z.object({
  userId: z.string().uuid(),
  target: z.number().int().min(1).max(50),
});

const ADAPTER_TIMEOUT_MS = 8_000;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);

export const Route = createFileRoute('/api/public/sources/run-batch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasCronSecret(request)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch (e) {
          return Response.json(
            { error: 'Invalid body', detail: String(e) },
            { status: 400 },
          );
        }
        const { userId, target } = body;

        // Per-user keyword/location context for relevance gating.
        const { data: settings } = await supabaseAdmin
          .from('automation_settings')
          .select('target_titles, target_locations')
          .eq('user_id', userId)
          .maybeSingle();
        const queries = (settings?.target_titles ?? []).filter(
          (q: string) => q && q.trim().length > 0,
        );
        const locations = (settings?.target_locations ?? []).filter(
          (l: string) => l && l.trim().length > 0,
        );
        const ctx = { queries, locations };

        // Source order: hot aggregators first (fastest), then USAJobs, then apify (slow).
        const specs: Array<{ provider: string; slug?: string }> = [
          ...AGGREGATOR_PROVIDERS.map((provider) => ({ provider })),
          ...USAJOBS_QUERIES,
          ...APIFY_PROVIDERS.map((provider) => ({ provider })),
        ];

        const startedAt = new Date().toISOString();
        const perSource: Array<{
          key: string;
          fetched: number;
          inserted: number;
          matched: number;
          error?: string;
        }> = [];
        let totalMatched = 0;
        let totalFetched = 0;
        let totalInserted = 0;

        for (const spec of specs) {
          if (totalMatched >= target) break;
          const sourceKey = spec.slug ? `${spec.provider}:${spec.slug}` : spec.provider;
          const entry = { key: sourceKey, fetched: 0, inserted: 0, matched: 0 } as {
            key: string;
            fetched: number;
            inserted: number;
            matched: number;
            error?: string;
          };

          let jobs: NormalizedJob[] = [];
          try {
            jobs = await withTimeout(runSource(spec, ctx), ADAPTER_TIMEOUT_MS);
          } catch (e) {
            entry.error = String(e).slice(0, 200);
            perSource.push(entry);
            continue;
          }
          entry.fetched = jobs.length;
          totalFetched += jobs.length;
          if (jobs.length === 0) {
            perSource.push(entry);
            continue;
          }

          // Upsert in chunks but check matched count after every chunk so we can stop early.
          const remaining = () => target - totalMatched;
          for (let j = 0; j < jobs.length && remaining() > 0; j += 50) {
            const chunk = jobs.slice(j, j + 50).map((nj) => ({
              ...nj,
              raw: nj.raw as never,
              user_id: userId,
              matched: false,
              score: 0,
              status: 'new',
            }));
            const { data: upserted, error } = await supabaseAdmin
              .from('jobs')
              .upsert(chunk, { onConflict: 'user_id,dedupe_hash', ignoreDuplicates: true })
              .select('id');
            if (error) {
              entry.error = `insert: ${error.message}`.slice(0, 200);
              continue;
            }
            const ids = (upserted ?? []).map((r) => r.id as string);
            entry.inserted += ids.length;
            totalInserted += ids.length;
            if (ids.length === 0) continue;

            // Score each new row.
            await Promise.all(
              ids.map((id) =>
                supabaseAdmin.rpc('match_job_to_filters', { _job_id: id }),
              ),
            );
            // Count how many of those rows ended up matched=true.
            const { count } = await supabaseAdmin
              .from('jobs')
              .select('id', { count: 'exact', head: true })
              .in('id', ids)
              .eq('matched', true);
            const matchedHere = count ?? 0;
            entry.matched += matchedHere;
            totalMatched += matchedHere;
          }
          perSource.push(entry);
        }

        // Log the run.
        await supabaseAdmin.from('automation_runs').insert({
          user_id: userId,
          kind: 'source.batch',
          source_key: `batch:target:${target}`,
          status: totalMatched > 0 ? 'succeeded' : 'failed',
          items_in: totalFetched,
          items_out: totalInserted,
          errors: perSource.filter((p) => p.error).length,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          metadata: { target, matched: totalMatched, perSource: perSource.slice(0, 30) },
        });

        return Response.json({
          ok: true,
          target,
          matched: totalMatched,
          fetched: totalFetched,
          inserted: totalInserted,
          perSource,
        });
      },
    },
  },
});
