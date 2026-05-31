/**
 * Tiny server fn to verify the current user from any context (SSR or browser).
 * Returns { userId, email } when the request carries a valid Supabase JWT;
 * throws Unauthorized otherwise (caught by the layout's beforeLoad).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getAuthUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { userId: context.userId, email: context.claims?.email ?? null };
  });
