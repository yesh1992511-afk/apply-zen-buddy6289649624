import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastError } from "@/lib/toast";
import type { AutomationPatch } from "@/lib/validation/settings";

export type AutomationSettings = {
  user_id: string;
  enabled: boolean;
  run_24_7: boolean;
  daily_start: string | null;
  daily_end: string | null;
  timezone: string | null;
  max_applies_per_day: number;
  parallelism: number;
  aggressiveness: number;
  exclude_companies: string[];
  captcha_provider: string | null;
  proxy_provider: string | null;
  ai_resume_model: string | null;
  ai_reasoning_model: string | null;
  active_filter_id: string | null;
};

export const automationKey = ["automation_settings"] as const;

export const automationQueryOptions = () =>
  queryOptions({
    queryKey: automationKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_settings")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as AutomationSettings | null;
    },
    staleTime: 15_000,
  });

export const filtersListQueryOptions = () =>
  queryOptions({
    queryKey: ["filters", "id-name"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filters")
        .select("id, name")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    staleTime: 60_000,
  });

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: AutomationPatch) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("automation_settings")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("user_id", u.user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: automationKey }),
    onError: (e) => toastError(e),
  });
}
