/**
 * Notification settings + Gmail credentials server functions.
 *
 * SMTP send + verification happens directly in the TanStack server runtime
 * via nodemailer (smtp.gmail.com:465). The Python worker is NOT involved
 * in the user-facing notification path — it only handles applies/scraping.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// nodemailer is lazy-imported inside sendUserEmailRaw() to avoid evaluating
// its Node-only internals (__dirname, dynamic requires) during SSR module
// load on Cloudflare Workers — that crashes every route in the bundle.
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
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
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
    const cleaned = data.app_password.replace(/\s+/g, "");
    if (cleaned.length !== 16) {
      throw new Error(
        "Gmail App Passwords are exactly 16 characters (spaces are ignored). Generate a fresh one at myaccount.google.com/apppasswords."
      );
    }
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
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
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
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    return { ok: true };
  });

/** Translate raw SMTP errors into actionable messages. */
function explainSmtpError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string; responseCode?: number } | null)?.code ?? "";
  if (/535[- ]5\.7\.8/i.test(raw) || /Username and Password not accepted/i.test(raw)) {
    return "Gmail rejected the App Password. Make sure 2-Step Verification is ON and you pasted a fresh 16-character App Password (no spaces). Generate a new one at myaccount.google.com/apppasswords.";
  }
  if (/534[- ]5\.7\.9/i.test(raw)) {
    return "Gmail requires an App Password (not your regular password). Enable 2-Step Verification first, then create one at myaccount.google.com/apppasswords.";
  }
  if (code === "EAUTH") {
    return "Authentication failed. Re-generate the App Password and try again.";
  }
  if (code === "EDNS" || code === "ECONNECTION" || code === "ETIMEDOUT" || /ECONNREFUSED/i.test(raw)) {
    return "Couldn't reach smtp.gmail.com. Check your network and try again.";
  }
  if (/Invalid login/i.test(raw)) {
    return "Invalid Gmail login. Confirm the email address matches the Google account that generated the App Password.";
  }
  return raw;
}

/** Send an email using the user's stored Gmail credentials. Shared by test + real notifications. */
export async function sendUserEmailRaw(args: {
  email: string;
  appPassword: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ messageId: string }> {
  const { default: nodemailer } = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: args.email, pass: args.appPassword },
  });
  // verify() catches auth/connection errors before sendMail.
  await transporter.verify();
  const info = await transporter.sendMail({
    from: `"JobPilot" <${args.email}>`,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html ?? `<pre style="font-family:ui-monospace,monospace">${args.text}</pre>`,
  });
  return { messageId: info.messageId };
}

/**
 * Verify Gmail credentials by sending a real test email via SMTP.
 * On success, stamps verified_at; on failure, records last_error.
 * Returns the user-facing outcome synchronously — no worker round-trip.
 */
export const verifyAndSendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: creds, error: credsErr } = await supabase
      .from("gmail_credentials")
      .select("email,app_password")
      .eq("user_id", userId)
      .maybeSingle();
    if (credsErr) throw new Error(credsErr.message);
    if (!creds) throw new Error("No Gmail credentials saved. Add your address and App Password first.");

    const { data: settings } = await supabase
      .from("notification_settings")
      .select("recipient_email")
      .eq("user_id", userId)
      .maybeSingle();
    const recipient = settings?.recipient_email || creds.email;

    const subject = "JobPilot — test email ✓";
    const text = `This is a JobPilot test email confirming your Gmail App Password works.

Sent from: ${creds.email}
Delivered to: ${recipient}
Time: ${new Date().toISOString()}

If you're seeing this, notifications are wired up correctly. You can close this email.`;
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px;font-size:20px">JobPilot test email ✓</h2>
        <p style="color:#475569;line-height:1.5">Your Gmail App Password works — notifications are wired up correctly.</p>
        <div style="background:#f1f5f9;border-radius:8px;padding:14px 16px;margin:18px 0;font-size:13px;color:#334155">
          <div><strong>Sent from:</strong> ${creds.email}</div>
          <div><strong>Delivered to:</strong> ${recipient}</div>
          <div><strong>Time:</strong> ${new Date().toISOString()}</div>
        </div>
        <p style="color:#94a3b8;font-size:12px">You can close this email.</p>
      </div>`;

    try {
      const { messageId } = await sendUserEmailRaw({
        email: creds.email,
        appPassword: creds.app_password,
        to: recipient,
        subject,
        text,
        html,
      });

      await supabase
        .from("gmail_credentials")
        .update({ verified_at: new Date().toISOString(), last_error: null })
        .eq("user_id", userId);

      await supabase.from("notification_log").insert({
        user_id: userId,
        kind: "test",
        subject,
        recipient_email: recipient,
        status: "sent",
        metadata: { message_id: messageId },
      });

      return { ok: true as const, messageId, recipient };
    } catch (err) {
      const friendly = explainSmtpError(err);
      await supabase
        .from("gmail_credentials")
        .update({ verified_at: null, last_error: friendly })
        .eq("user_id", userId);
      await supabase.from("notification_log").insert({
        user_id: userId,
        kind: "test",
        subject,
        recipient_email: recipient,
        status: "failed",
        last_error: friendly,
      });
      throw new Error(friendly);
    }
  });

/** Back-compat alias: the old name `sendTestNotification` still works. */
export const sendTestNotification = verifyAndSendTestEmail;
