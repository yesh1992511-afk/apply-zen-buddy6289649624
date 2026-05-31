import { z } from "zod";

// ---------- Automation ----------
export const automationSchema = z.object({
  enabled: z.boolean(),
  run_24_7: z.boolean(),
  daily_start: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  daily_end: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  timezone: z.string().trim().min(1).max(64).nullable().optional(),
  max_applies_per_day: z.number().int().min(1).max(500),
  parallelism: z.number().int().min(1).max(10),
  aggressiveness: z.number().int().min(1).max(5),
  exclude_companies: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  captcha_provider: z.string().trim().max(40).nullable().optional(),
  proxy_provider: z.enum(["decodo", "iproyal", "brightdata", "smartproxy", "oxylabs"]).nullable().optional(),
  ai_resume_model: z.string().trim().max(120).nullable().optional(),
  ai_reasoning_model: z.string().trim().max(120).nullable().optional(),
  active_filter_id: z.string().uuid().nullable().optional(),
});
export type AutomationPatch = Partial<z.infer<typeof automationSchema>>;

// Cross-field check used when persisting full sections
export function validateAutomationCross(s: AutomationPatch): string | null {
  if (s.run_24_7 === false && s.daily_start && s.daily_end && s.daily_start >= s.daily_end) {
    return "Daily start must be before daily end.";
  }
  return null;
}

// ---------- Notifications ----------
export const notificationsSchema = z.object({
  recipient_email: z.string().trim().email().max(255).nullable().optional(),
  notify_manual_review: z.boolean(),
  notify_apply_failed: z.boolean(),
  notify_worker_offline: z.boolean(),
  notify_high_score: z.boolean(),
  high_score_threshold: z.number().int().min(0).max(100),
  daily_summary_enabled: z.boolean(),
  daily_summary_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});
export type NotificationsPatch = Partial<z.infer<typeof notificationsSchema>>;

// ---------- Filters ----------
export const filterSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  keywords: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  exclude_keywords: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  exclude_companies: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  locations: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  seniority: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  employment_type: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  remote_only: z.boolean().optional(),
  hybrid_ok: z.boolean().optional(),
  onsite_ok: z.boolean().optional(),
  salary_min: z.number().int().min(0).max(10_000_000).nullable().optional(),
  posted_within_hours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365),
  min_score: z.number().int().min(0).max(100),
});
export type FilterPatch = Partial<z.infer<typeof filterSchema>>;

// ---------- Gmail ----------
export const gmailSchema = z.object({
  email: z.string().trim().email().max(255),
  app_password: z.string().trim().min(16).max(120),
});
