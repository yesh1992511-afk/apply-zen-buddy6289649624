/**
 * Bootstrap the apply-worker cron schedule + Vault secret.
 *
 * Auth: requires a logged-in app user (Authorization: Bearer <jwt>).
 * Effect: copies process.env.WORKER_CRON_SECRET into Vault as 'worker_cron_secret'
 * and (re)schedules the every-minute pg_cron job that pings /api/public/hooks/apply-worker.
 * Safe to call repeatedly.
 */
import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/hooks/bootstrap-cron')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get('authorization') ?? '';
        const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
        if (!token) return new Response('Unauthorized', { status: 401 });
        const { data: u, error: ue } = await supabaseAdmin.auth.getUser(token);
        if (ue || !u?.user?.id) return new Response('Unauthorized', { status: 401 });

        const secret = process.env.WORKER_CRON_SECRET;
        if (!secret || secret.length < 16) {
          return Response.json({ ok: false, error: 'WORKER_CRON_SECRET missing/short' }, { status: 500 });
        }

        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        const { data, error } = await supabaseAdmin.rpc('bootstrap_apply_worker_cron', {
          _secret: secret,
          _base_url: baseUrl,
        });
        if (error) {
          console.error('[bootstrap-cron] rpc error', error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, baseUrl, result: data });
      },
    },
  },
});
