import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastError, toastSaved } from "@/lib/toast";

export type Filter = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  keywords: string[];
  exclude_keywords: string[];
  exclude_companies: string[];
  locations: string[];
  remote_only: boolean;
  hybrid_ok: boolean;
  onsite_ok: boolean;
  salary_min: number | null;
  posted_within_hours: number;
  seniority: string[];
  employment_type: string[];
  min_score: number;
};

export const filtersKey = ["filters", "all"] as const;

export const filtersQueryOptions = () =>
  queryOptions({
    queryKey: filtersKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filters")
        .select("*")
        .order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Filter[];
    },
    staleTime: 15_000,
  });

export function useCreateFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (existingCount: number) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("filters")
        .insert({ user_id: u.user.id, name: "New filter", is_default: existingCount === 0 });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toastSaved("Filter created");
      qc.invalidateQueries({ queryKey: filtersKey });
    },
    onError: (e) => toastError(e),
  });
}

export function useUpdateFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Filter> }) => {
      const { error } = await supabase
        .from("filters")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: filtersKey }),
    onError: (e) => toastError(e),
  });
}

export function useSetDefaultFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      await supabase.from("filters").update({ is_default: false }).eq("user_id", u.user.id);
      const { error } = await supabase.from("filters").update({ is_default: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toastSaved("Default updated");
      qc.invalidateQueries({ queryKey: filtersKey });
    },
    onError: (e) => toastError(e),
  });
}

export function useDeleteFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("filters").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toastSaved("Filter deleted");
      qc.invalidateQueries({ queryKey: filtersKey });
    },
    onError: (e) => toastError(e),
  });
}
