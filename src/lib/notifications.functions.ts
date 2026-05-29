/**
 * Notification settings + Gmail credentials server functions.
 * IMAP/SMTP work happens in the worker; these server fns just manage rows.
 * A "test" command is enqueued into worker_commands so the worker actually
 * tries the credentials and reports back.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: settings }, { data: creds }, { data: log }] = await Promise.all([
      supabase.from("notification_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("gmail_credentials")
        .select("id,email,verified_at,last_error,imap_host,smtp_host,updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("notification_log")
        .select("id,kind,subject,recipient_email,status,last_error,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { settings: settings ?? null, creds: creds ?? null, log: log ?? [] };
  });

const SettingsInput = z.object({
  recipient_email: z.string().email().nullable().optional(),
  notify_manual_review: z.boolean().optional(),
  notify_high_score: z.boolean().optional(),
  high_score_threshold: z.number().int().min(50).max(100).optional(),
  notify_apply_failed: z.boolean().optional(),
  notify_worker_offline: z.boolean().optional(),
  daily_summary_enabled: z.boolean().optional(),
  daily_summary_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

export const saveNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_settings")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CredsInput = z.object({
  email: z.string().email(),
  app_password: z.string().min(8).max(64),
});

export const saveGmailCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CredsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Gmail App Passwords are 16 chars without spaces. Strip whitespace.
    const cleaned = data.app_password.replace(/\s+/g, "");
    const { error } = await supabase
      .from("gmail_credentials")
      .upsert(
        {
          user_id: userId,
          email: data.email,
          app_password: cleaned,
          last_error: null,
          verified_at: null,
        },
        { onConflict: "user_id" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGmailCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("gmail_credentials")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Enqueue a `notify_test` worker command. UI polls notification_log for the result. */
export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("worker_commands")
      .insert({ user_id: userId, kind: "notify_test", payload: {} })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { command_id: data.id };
  });
