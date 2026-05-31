/**
 * System readiness checklist. Aggregates the signals that determine whether
 * the autopilot can actually run end-to-end: profile, resume, gmail, secrets,
 * worker heartbeat, job target, sources, filter.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadinessCheck = {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  href: string;
};

export type ReadinessReport = {
  checks: ReadinessCheck[];
  okCount: number;
  failCount: number;
  warnCount: number;
  ready: boolean; // true iff no fails
};

export const getSystemReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReadinessReport> => {
    const { supabase, userId } = context;

    const [
      { data: profile },
      { data: resumes },
      { data: gmail },
      { data: hb },
      { data: settings },
      { data: sources },
      { data: filters },
      { data: secrets },
    ] = await Promise.all([
      supabase.from("profile").select("full_name,email,phone,location,years_experience,headline,work_authorization").eq("user_id", userId).maybeSingle(),
      supabase.from("resumes").select("id,is_default,tex_content").eq("user_id", userId),
      supabase.from("gmail_credentials").select("verified_at,last_error,email").eq("user_id", userId).maybeSingle(),
      supabase.from("worker_heartbeat").select("last_seen,version").eq("user_id", userId).maybeSingle(),
      supabase.from("automation_settings").select("enabled,target_titles,target_country,proxy_provider").eq("user_id", userId).maybeSingle(),
      supabase.from("sources").select("id,enabled").eq("user_id", userId),
      supabase.from("filters").select("id,is_default").eq("user_id", userId),
      supabase.from("secrets_meta").select("name,status,category").eq("user_id", userId),
    ]);

    const checks: ReadinessCheck[] = [];

    // 1. Profile completeness
    const pFields = ["full_name", "email", "phone", "location", "years_experience", "headline", "work_authorization"] as const;
    const pFilled = pFields.filter((k) => {
      const v = (profile as Record<string, unknown> | null)?.[k];
      return v !== null && v !== undefined && v !== "";
    }).length;
    const pPct = Math.round((pFilled / pFields.length) * 100);
    checks.push({
      key: "profile",
      label: "Profile completeness",
      status: pPct >= 90 ? "ok" : pPct >= 60 ? "warn" : "fail",
      detail: `${pPct}% of essential fields filled (${pFilled}/${pFields.length})`,
      href: "/profile",
    });

    // 2. Default resume
    const def = (resumes ?? []).find((r) => r.is_default);
    checks.push({
      key: "resume",
      label: "Default resume",
      status: def && def.tex_content ? "ok" : (resumes?.length ? "warn" : "fail"),
      detail: def ? "Default resume set and has LaTeX content" : (resumes?.length ? "Resumes exist but none marked default" : "No resume uploaded"),
      href: "/profile",
    });

    // 3. Gmail credentials
    checks.push({
      key: "gmail",
      label: "Gmail credentials verified",
      status: gmail?.verified_at ? "ok" : gmail?.email ? "warn" : "fail",
      detail: gmail?.verified_at
        ? `Verified for ${gmail.email}`
        : gmail?.last_error
          ? `Saved but not verified — ${gmail.last_error}`
          : "Required for OTPs and reply detection",
      href: "/notifications",
    });

    // 4. Captcha key
    const captcha = (secrets ?? []).find((s) => s.category === "captcha" && s.status === "set");
    checks.push({
      key: "captcha",
      label: "Captcha solver key",
      status: captcha ? "ok" : "fail",
      detail: captcha ? `Configured (${captcha.name})` : "2captcha or CapSolver key required for protected portals",
      href: "/setup",
    });

    // 5. Proxy
    const proxy = (secrets ?? []).find((s) => s.category === "proxy" && s.status === "set");
    checks.push({
      key: "proxy",
      label: "Residential proxy",
      status: proxy ? "ok" : "warn",
      detail: proxy ? `Configured (${proxy.name})` : "Optional but strongly recommended for LinkedIn/Indeed",
      href: "/setup",
    });

    // 6. Worker heartbeat
    const ageMs = hb?.last_seen ? Date.now() - new Date(hb.last_seen).getTime() : Infinity;
    checks.push({
      key: "worker",
      label: "Worker heartbeat",
      status: ageMs < 5 * 60_000 ? "ok" : ageMs < 60 * 60_000 ? "warn" : "fail",
      detail: hb?.last_seen
        ? `Last seen ${Math.round(ageMs / 1000)}s ago${hb.version ? ` · v${hb.version}` : ""}`
        : "Worker has never checked in — start docker-compose on your VPS",
      href: "/worker",
    });

    // 7. Job target
    const titles = settings?.target_titles ?? [];
    checks.push({
      key: "target",
      label: "Job target applied",
      status: titles.length > 0 ? "ok" : "fail",
      detail: titles.length > 0
        ? `${titles.length} title keyword${titles.length === 1 ? "" : "s"} · country=${settings?.target_country ?? "—"}`
        : "Pick a preset on the Sources page so scrapers know what to search for",
      href: "/sources",
    });

    // 8. Sources enabled
    const enabledSources = (sources ?? []).filter((s) => s.enabled).length;
    checks.push({
      key: "sources",
      label: "Active sources",
      status: enabledSources >= 3 ? "ok" : enabledSources >= 1 ? "warn" : "fail",
      detail: `${enabledSources} source${enabledSources === 1 ? "" : "s"} enabled`,
      href: "/sources",
    });

    // 9. Default filter
    const defFilter = (filters ?? []).find((f) => f.is_default);
    checks.push({
      key: "filter",
      label: "Default filter",
      status: defFilter ? "ok" : (filters?.length ? "warn" : "fail"),
      detail: defFilter ? "Default filter set" : (filters?.length ? "Save a filter as default" : "No filters yet"),
      href: "/filters",
    });

    // 10. Automation toggle
    checks.push({
      key: "automation",
      label: "Autopilot enabled",
      status: settings?.enabled ? "ok" : "warn",
      detail: settings?.enabled ? "Worker will auto-apply within your daily budget" : "Manual only — flip on when you trust the pipeline",
      href: "/automation",
    });

    const okCount = checks.filter((c) => c.status === "ok").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;
    const failCount = checks.filter((c) => c.status === "fail").length;

    return { checks, okCount, warnCount, failCount, ready: failCount === 0 };
  });
