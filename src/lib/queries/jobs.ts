import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastError, toastQueued, toastSaved } from "@/lib/toast";
import { useServerFn } from "@tanstack/react-start";
import { rescoreAllJobs } from "@/lib/applications.functions";

/** Re-score every existing job using the latest filter + Job Target settings. */
export function useRescoreAllJobs() {
  const queryClient = useQueryClient();
  const fn = useServerFn(rescoreAllJobs);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: ({ rescored }) => {
      toastSaved(`Re-scored ${rescored} job${rescored === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e) => toastError(e),
  });
}

/** Delete every scraped job (and dependent rows) for the signed-in user. */
export function useClearAllJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const uid = u.user.id;
      // Order matters: clear dependents before jobs.
      await supabase.from("application_events").delete().eq("user_id", uid);
      await supabase.from("logs").delete().eq("user_id", uid).not("job_id", "is", null);
      await supabase.from("notification_log").delete().eq("user_id", uid).not("job_id", "is", null);
      await supabase.from("applications").delete().eq("user_id", uid);
      const { error, count } = await supabase
        .from("jobs")
        .delete({ count: "exact" })
        .eq("user_id", uid);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    onSuccess: (n) => {
      toastSaved(`Cleared ${n} job${n === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toastError(e),
  });
}

/** Counts of scraped vs matched jobs for the signed-in user (lifetime). */
export const jobCountsQueryOptions = () =>
  queryOptions({
    queryKey: ["jobs", "counts"] as const,
    queryFn: async (): Promise<{ scraped: number; matched: number }> => {
      const [scrapedRes, matchedRes] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("matched", true),
      ]);
      if (scrapedRes.error) throw new Error(scrapedRes.error.message);
      if (matchedRes.error) throw new Error(matchedRes.error.message);
      return { scraped: scrapedRes.count ?? 0, matched: matchedRes.count ?? 0 };
    },
    staleTime: 30_000,
  });

/** Loosen the user's active/default filter (7-day window, min score 20). */
export function useLoosenActiveFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      // Prefer default filter, otherwise loosen all filters for the user.
      const { data: def } = await supabase
        .from("filters").select("id").eq("user_id", u.user.id).eq("is_default", true).maybeSingle();
      const target = def?.id
        ? supabase.from("filters").update({ posted_within_hours: 168, min_score: 20 } as never).eq("id", def.id)
        : supabase.from("filters").update({ posted_within_hours: 168, min_score: 20 } as never).eq("user_id", u.user.id);
      const { error } = await target;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toastSaved("Filter loosened — 7 day window, min score 20");
      queryClient.invalidateQueries({ queryKey: ["filters"] });
    },
    onError: (e) => toastError(e),
  });
}

/** Source keys that don't pre-filter by keyword and tend to flood the feed. */
export const NOISY_SOURCE_KEYS = [
  "arbeitnow", "weworkremotely", "usajobs", "remoteok",
  "himalayas", "jobicy", "remotive", "builtin",
  "greenhouse:airbnb", "greenhouse:cloudflare", "greenhouse:reddit", "greenhouse:roblox",
] as const;

/** Disable all noisy sources for the signed-in user. */
export function useDisableNoisySources() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error, count } = await supabase
        .from("sources")
        .update({ enabled: false } as never, { count: "exact" })
        .eq("user_id", u.user.id)
        .in("key", NOISY_SOURCE_KEYS as unknown as string[])
        .eq("enabled", true);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    onSuccess: (n) => {
      toastSaved(`Disabled ${n} noisy source${n === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (e) => toastError(e),
  });
}


export type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  url: string;
  source_key: string;
  posted_at: string | null;
  scraped_at: string;
  score: number;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  employment_type: string | null;
  seniority: string | null;
  description: string | null;
  description_html: string | null;
  status: string;
};

export const jobsKey = (params: { hours: number }) =>
  ["jobs", "matched", params] as const;

export const jobsQueryOptions = (params: { hours: number }) =>
  queryOptions({
    queryKey: jobsKey(params),
    queryFn: async (): Promise<Job[]> => {
      let q = supabase
        .from("jobs")
        .select("*")
        .eq("matched", true)
        .order("score", { ascending: false })
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (params.hours > 0) {
        const since = new Date(Date.now() - params.hours * 3600_000).toISOString();
        q = q.gte("scraped_at", since);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Job[];
    },
    staleTime: 15_000,
  });

export const savedFiltersQueryOptions = () =>
  queryOptions({
    queryKey: ["filters", "saved-list"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filters")
        .select("id, name, keywords")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ id: string; name: string; keywords: string[] }>;
    },
    staleTime: 60_000,
  });

/** Friendly toast for Postgres quota violations from enforce_apply_quota trigger. */
function toastApplyError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Daily apply limit reached/i.test(msg) || /check_violation/i.test(msg)) {
    toastError(new Error("Daily apply cap reached — upgrade your plan or wait until tomorrow."));
  } else if (/Source limit reached/i.test(msg)) {
    toastError(new Error("Source limit reached — upgrade your plan to add more."));
  } else {
    toastError(e);
  }
}

/** Queue a single job for the worker; returns the application id. */
export function useApplyToJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("job_id", jobId)
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (existing?.id) return { id: existing.id, existed: true };
      const { data, error } = await supabase
        .from("applications")
        .insert({ job_id: jobId, user_id: u.user.id, status: "queued" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      // Best-effort: kick the worker immediately
      fetch(`/api/public/hooks/apply-worker?application_id=${data.id}`, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      }).catch(() => {});
      return { id: data.id as string, existed: false };
    },
    onSuccess: (res) => {
      if (res.existed) toastSaved("Already queued — opening application");
      else toastSaved("Application queued — worker starting");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: toastApplyError,
  });
}

/** Bulk queue selected jobs. */
export function useBulkQueueApplies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobIds: string[]) => {
      if (jobIds.length === 0) return 0;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const rows = jobIds.map((job_id) => ({
        job_id,
        user_id: u.user!.id,
        status: "queued" as const,
      }));
      const { error } = await supabase.from("applications").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: (n) => {
      if (n > 0) toastQueued(n);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: toastApplyError,
  });
}


/** Today's apply budget — used count vs. configured daily cap. */
export function useDailyApplyBudget() {
  return useQuery({
    queryKey: ["apply-budget", "today"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { used: 0, cap: 0, atCap: false };
      const uid = u.user.id;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: quota }, { data: settings }] = await Promise.all([
        supabase
          .from("usage_quotas")
          .select("applies_count")
          .eq("user_id", uid)
          .eq("day", today)
          .maybeSingle(),
        supabase
          .from("automation_settings")
          .select("max_applies_per_day")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
      const used = quota?.applies_count ?? 0;
      const cap = settings?.max_applies_per_day ?? 50;
      return { used, cap, atCap: cap > 0 && used >= cap };
    },
  });
}
