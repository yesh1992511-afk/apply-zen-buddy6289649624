import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastError, toastQueued, toastSaved } from "@/lib/toast";

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
    },
    onError: (e) => toastError(e),
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
    },
    onError: (e) => toastError(e),
  });
}
