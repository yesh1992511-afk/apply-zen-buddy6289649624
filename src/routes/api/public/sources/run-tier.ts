import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { runSource, AGGREGATOR_PROVIDERS, type NormalizedJob } from '@/lib/sources/adapters.server';
import { SEED_SLUGS } from '@/lib/sources/seed-slugs';

/**
 * Public cron endpoint. Called by pg_cron every 15min (hot) and 60min (warm).
 *
 * GET /api/public/sources/run-tier?tier=hot|warm&shard=0..3
 *
 * For every user with `automation_settings.enabled = true`, fetch the
 * configured sources, upsert into jobs, and run the scoring function.
 * No auth header needed — /api/public/* bypasses auth at the edge.
 * We rate-limit per-IP at the cron layer (only pg_cron calls this).
 */
export const Route = createFileRoute('/api/public/sources/run-tier')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const tier = (url.searchParams.get('tier') ?? 'hot') as 'hot' | 'warm';
        const shard = Number(url.searchParams.get('shard') ?? 0);
        const forcedUserId = url.searchParams.get('user_id');

        // If a user_id is passed (manual "Run now" from the UI) we run for that user
        // regardless of automation_settings.enabled. Otherwise cron-mode: only enabled users.
        let users: Array<{ user_id: string }> | null = null;
        if (forcedUserId) {
          users = [{ user_id: forcedUserId }];
        } else {
          const { data, error: usersErr } = await supabaseAdmin
            .from('automation_settings')
            .select('user_id, enabled')
            .eq('enabled', true);
          if (usersErr) return Response.json({ error: usersErr.message }, { status: 500 });
          users = (data ?? []) as Array<{ user_id: string }>;
        }
        if (!users.length) {
          return Response.json({ ok: true, message: 'no enabled users', tier, shard });
        }

        const sourceSpecs: Array<{ provider: string; slug?: string }> =
          tier === 'hot'
            ? AGGREGATOR_PROVIDERS.map((provider) => ({ provider }))
            : SEED_SLUGS.filter((_, i) => i % 4 === shard).map((s) => ({ provider: s.provider, slug: s.slug }));

        const summary: Record<string, { fetched: number; inserted: number; errors: number }> = {};

        for (const userRow of users) {
          const userId = userRow.user_id as string;
          const runId = crypto.randomUUID();
          const startedAt = new Date().toISOString();

          let totalIn = 0;
          let totalOut = 0;
          let totalErr = 0;

          // Fetch in concurrent batches of 8
          for (let i = 0; i < sourceSpecs.length; i += 8) {
            const batch = sourceSpecs.slice(i, i + 8);
            const results = await Promise.allSettled(batch.map((s) => runSource(s)));

            for (let k = 0; k < results.length; k++) {
              const spec = batch[k];
              const key = spec.slug ? `${spec.provider}:${spec.slug}` : spec.provider;
              summary[key] ||= { fetched: 0, inserted: 0, errors: 0 };
              const r = results[k];
              if (r.status === 'rejected') {
                summary[key].errors++;
                totalErr++;
                continue;
              }
              const jobs: NormalizedJob[] = r.value;
              summary[key].fetched += jobs.length;
              totalIn += jobs.length;

              if (!jobs.length) continue;

              // Upsert in chunks
              for (let j = 0; j < jobs.length; j += 100) {
                const chunk = jobs.slice(j, j + 100).map((nj) => ({
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
                  summary[key].errors++;
                  totalErr++;
                  continue;
                }
                summary[key].inserted += upserted?.length ?? 0;
                totalOut += upserted?.length ?? 0;

                // Score newly-inserted jobs against user filters
                if (upserted?.length) {
                  await Promise.all(
                    upserted.map((row) =>
                      supabaseAdmin.rpc('match_job_to_filters', { _job_id: row.id }),
                    ),
                  );
                }
              }
            }
          }

          await supabaseAdmin.from('automation_runs').insert({
            id: runId,
            user_id: userId,
            kind: `source.${tier}`,
            source_key: `tier:${tier}:shard:${shard}`,
            status: 'succeeded',
            items_in: totalIn,
            items_out: totalOut,
            errors: totalErr,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            metadata: { tier, shard, sources: Object.keys(summary).length },
          });
        }

        return Response.json({ ok: true, tier, shard, users: users.length, summary });
      },
    },
  },
});
