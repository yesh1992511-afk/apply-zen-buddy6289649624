import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  runSource,
  AGGREGATOR_PROVIDERS,
  APIFY_PROVIDERS,
  USAJOBS_QUERIES,
  type NormalizedJob,
} from '@/lib/sources/adapters.server';
import { SEED_SLUGS } from '@/lib/sources/seed-slugs';

/**
 * Public cron endpoint. Called by pg_cron at multiple cadences.
 *
 * GET /api/public/sources/run-tier?tier=hot|warm|usajobs|apify&shard=0..3[&user_id=<uuid>]
 *
 * Tiers:
 *  - hot     → aggregators (RemoteOK, Remotive, …) — every 15min
 *  - warm    → ATS slugs (Greenhouse, Lever, Ashby, …) — every 60min, 4 shards
 *  - usajobs → federal API keyword queries — every 60min
 *  - apify   → cached datasets from last-succeeded Apify runs — every 4h
 *
 * For every user with `automation_settings.enabled = true`, fetch the configured
 * sources, upsert into jobs, score them via match_job_to_filters, and write
 * heartbeat rows to automation_runs + per-source health to sources.
 */
export const Route = createFileRoute('/api/public/sources/run-tier')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Auth: either cron secret OR a logged-in user JWT.
        const { requireUserOrCron } = await import('@/lib/api-auth.server');
        let auth;
        try {
          auth = await requireUserOrCron(request);
        } catch {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const tier = (url.searchParams.get('tier') ?? 'hot') as 'hot' | 'warm' | 'usajobs' | 'apify';
        const shard = Number(url.searchParams.get('shard') ?? 0);

        let users: Array<{ user_id: string }> | null = null;
        if (!auth.isCron) {
          // User-scoped: ignore any ?user_id= query param, always use the JWT user.
          users = [{ user_id: auth.userId }];
        } else {
          // Cron: optional user_id forces a single user, else process all enabled.
          const forcedUserId = url.searchParams.get('user_id');
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
        }
        if (!users.length) {
          return Response.json({ ok: true, message: 'no enabled users', tier, shard });
        }

        let sourceSpecs: Array<{ provider: string; slug?: string }>;
        switch (tier) {
          case 'hot':
            sourceSpecs = AGGREGATOR_PROVIDERS.map((provider) => ({ provider }));
            break;
          case 'warm':
            sourceSpecs = SEED_SLUGS
              .filter((_, i) => i % 8 === shard)
              .map((s) => ({ provider: s.provider, slug: s.slug }));
            break;
          case 'usajobs':
            sourceSpecs = USAJOBS_QUERIES;
            break;
          case 'apify':
            sourceSpecs = APIFY_PROVIDERS.map((provider) => ({ provider }));
            break;
          default:
            return Response.json({ error: `unknown tier: ${tier}` }, { status: 400 });
        }

        // Per-tier hard timeout on each adapter (kept low so total invocation fits Worker CPU budget)
        const adapterTimeoutMs = tier === 'apify' ? 30_000 : tier === 'usajobs' ? 10_000 : 7_000;
        const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
          ]);

        // sources.kind is an enum: 'apify' | 'rest' | 'board'
        const sourceKindFor = (provider: string): 'apify' | 'rest' | 'board' => {
          if (provider.startsWith('apify:')) return 'apify';
          if (['greenhouse','lever','ashby','workable','smartrecruiters','recruitee','teamtailor','personio','bamboohr'].includes(provider)) return 'board';
          return 'rest';
        };

        const summary: Record<
          string,
          { fetched: number; inserted: number; errors: number; error_message?: string }
        > = {};

        for (const userRow of users) {
          const userId = userRow.user_id as string;
          const runId = crypto.randomUUID();
          const startedAt = new Date().toISOString();

          let totalIn = 0;
          let totalOut = 0;
          let totalErr = 0;

          for (let i = 0; i < sourceSpecs.length; i += 8) {
            const batch = sourceSpecs.slice(i, i + 8);
            const results = await Promise.allSettled(
              batch.map((s) => withTimeout(runSource(s), adapterTimeoutMs)),
            );

            for (let k = 0; k < results.length; k++) {
              const spec = batch[k];
              const sourceKey = spec.slug ? `${spec.provider}:${spec.slug}` : spec.provider;
              summary[sourceKey] ||= { fetched: 0, inserted: 0, errors: 0 };
              const r = results[k];

              const runAt = new Date().toISOString();
              if (r.status === 'rejected') {
                summary[sourceKey].errors++;
                summary[sourceKey].error_message = String(r.reason).slice(0, 200);
                totalErr++;
                // Per-source health: failed — upsert base row then update status fields
                await supabaseAdmin.from('sources').upsert(
                  {
                    user_id: userId,
                    key: sourceKey,
                    display_name: sourceKey,
                    kind: sourceKindFor(spec.provider),
                    enabled: true,
                    cadence_minutes: tier === 'hot' ? 15 : tier === 'apify' ? 240 : 60,
                  },
                  { onConflict: 'user_id,key' },
                );
                await supabaseAdmin.from('sources').update({
                  last_run_at: runAt,
                  last_run_status: 'failed',
                  last_run_count: 0,
                  last_error: String(r.reason).slice(0, 500),
                }).eq('user_id', userId).eq('key', sourceKey);
                continue;
              }

              const jobs: NormalizedJob[] = r.value;
              summary[sourceKey].fetched += jobs.length;
              totalIn += jobs.length;

              let insertedForSource = 0;
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
                  summary[sourceKey].errors++;
                  summary[sourceKey].error_message = `insert: ${error.message}`.slice(0, 200);
                  totalErr++;
                  continue;
                }
                summary[sourceKey].inserted += upserted?.length ?? 0;
                insertedForSource += upserted?.length ?? 0;
                totalOut += upserted?.length ?? 0;

                if (upserted?.length) {
                  await Promise.all(
                    upserted.map((row) =>
                      supabaseAdmin.rpc('match_job_to_filters', { _job_id: row.id }),
                    ),
                  );
                }
              }

              // Per-source health: ok — upsert base row then update status fields
              await supabaseAdmin.from('sources').upsert(
                {
                  user_id: userId,
                  key: sourceKey,
                  display_name: sourceKey,
                  kind: sourceKindFor(spec.provider),
                  enabled: true,
                  cadence_minutes: tier === 'hot' ? 15 : tier === 'apify' ? 240 : 60,
                },
                { onConflict: 'user_id,key' },
              );
              await supabaseAdmin.from('sources').update({
                last_run_at: runAt,
                last_run_status: 'succeeded',
                last_run_count: insertedForSource,
                last_error: null,
              }).eq('user_id', userId).eq('key', sourceKey);
            }
          }

          await supabaseAdmin.from('automation_runs').insert({
            id: runId,
            user_id: userId,
            kind: `source.${tier}`,
            source_key: `tier:${tier}:shard:${shard}`,
            status: totalErr > 0 && totalOut === 0 ? 'failed' : 'succeeded',
            items_in: totalIn,
            items_out: totalOut,
            errors: totalErr,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            metadata: { tier, shard, sources: Object.keys(summary).length, errors: Object.entries(summary).filter(([, v]) => v.errors > 0).map(([k, v]) => ({ source: k, error: v.error_message })).slice(0, 10) },
          });
        }

        return Response.json({ ok: true, tier, shard, users: users.length, summary });
      },
    },
  },
});
