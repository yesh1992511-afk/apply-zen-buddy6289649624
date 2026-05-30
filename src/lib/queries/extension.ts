import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toastError, toastSaved } from "@/lib/toast";

export type ExtensionToken = {
  id: string;
  label: string;
  token: string;
  last_seen_at: string | null;
  captures_today: number;
  captures_total: number;
  created_at: string;
};

export const extensionTokensKey = ["extension_tokens"] as const;
export const extensionCapturesKey = ["extension_captures_24h"] as const;

export const extensionTokensQueryOptions = () =>
  queryOptions({
    queryKey: extensionTokensKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extension_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ExtensionToken[];
    },
    staleTime: 10_000,
  });

export const extensionCapturesQueryOptions = () =>
  queryOptions({
    queryKey: extensionCapturesKey,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("jobs")
        .select("source_key")
        .like("source_key", "ext_%")
        .gte("scraped_at", since);
      if (error) throw new Error(error.message);
      const stats: Record<string, number> = {};
      (data ?? []).forEach((j) => {
        const k = (j.source_key as string).replace("ext_", "");
        stats[k] = (stats[k] ?? 0) + 1;
      });
      return stats;
    },
    staleTime: 30_000,
  });

function genToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "jpx_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useCreateExtensionToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("extension_tokens").insert({
        user_id: u.user.id,
        token: genToken(),
        label: "My Browser",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toastSaved("Token created");
      qc.invalidateQueries({ queryKey: extensionTokensKey });
    },
    onError: (e) => toastError(e),
  });
}

export function useRevokeExtensionToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("extension_tokens").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toastSaved("Token revoked");
      qc.invalidateQueries({ queryKey: extensionTokensKey });
    },
    onError: (e) => toastError(e),
  });
}
