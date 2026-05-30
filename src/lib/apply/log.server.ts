/**
 * Service-role helper to write log rows (logs table has no INSERT policy for users).
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export async function writeLog(opts: {
  user_id: string;
  application_id?: string | null;
  job_id?: string | null;
  run_id?: string | null;
  level?: LogLevel;
  scope: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from('logs').insert({
    user_id: opts.user_id,
    application_id: opts.application_id ?? null,
    job_id: opts.job_id ?? null,
    run_id: opts.run_id ?? null,
    level: opts.level ?? 'info',
    scope: opts.scope,
    message: opts.message,
    metadata: (opts.metadata ?? null) as never,
  } as never);
}
