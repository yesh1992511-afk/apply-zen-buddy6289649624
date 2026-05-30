import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRoles() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.from("user_roles").select("role").then(({ data }) => {
      if (!alive) return;
      setRoles((data ?? []).map((r) => r.role as string));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  return {
    roles,
    loading,
    isOwner: roles.includes("owner"),
    isAdmin: roles.includes("owner") || roles.includes("admin"),
    isViewer: roles.includes("viewer"),
  };
}
