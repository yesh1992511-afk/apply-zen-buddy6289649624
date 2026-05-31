import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppPhase =
  | "discovered" | "scored" | "tailored" | "queued" | "applying" | "submitted"
  | "needs_review" | "failed" | "dead_letter" | "follow_up_sent" | "replied"
  | "interview" | "offer" | "rejected";

export type ApplicationRow = {
  id: string;
  status: string;
  phase: AppPhase;
  job_id: string;
  attempts: number;
  retry_count: number;
  last_error: string | null;
  dlq_reason: string | null;
  queued_at: string;
  applied_at: string | null;
  resume_id: string | null;
  cover_letter_id: string | null;
  generated_resume_id: string | null;
  job?: { title: string; company: string; url: string } | null;
};

export const APPLICATIONS_QUERY_KEY = ["applications", "list"] as const;

export function applicationsListQueryOptions() {
  return queryOptions({
    queryKey: APPLICATIONS_QUERY_KEY,
    queryFn: async (): Promise<ApplicationRow[]> => {
      const { data, error } = await supabase
        .from("applications")
        .select(
          "id, status, phase, job_id, attempts, retry_count, last_error, dlq_reason, queued_at, applied_at, resume_id, cover_letter_id, generated_resume_id, job:jobs(title, company, url)",
        )
        .order("queued_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as ApplicationRow[];
    },
    staleTime: 10_000,
  });
}

/** Back-compat: derive phase from legacy status when phase is missing/discovered. */
export function phaseOf(a: Pick<ApplicationRow, "phase" | "status">): AppPhase {
  if (a.phase && a.phase !== "discovered") return a.phase;
  const map: Record<string, AppPhase> = {
    queued: "queued",
    applying: "applying",
    applied: "submitted",
    needs_review: "needs_review",
    failed: "failed",
  };
  return map[a.status] ?? "discovered";
}

/** UI bucket used by the All-applications table tabs. */
export type AppBucket = "all" | "submitted" | "in_flight" | "needs_you" | "failed" | "skipped";

export function bucketOf(a: Pick<ApplicationRow, "phase" | "status">): Exclude<AppBucket, "all"> | null {
  const p = phaseOf(a);
  if (p === "submitted" || p === "follow_up_sent" || p === "replied" || p === "interview" || p === "offer") {
    return "submitted";
  }
  if (p === "queued" || p === "applying" || p === "tailored" || p === "scored") return "in_flight";
  if (p === "needs_review") return "needs_you";
  if (p === "failed" || p === "dead_letter" || p === "rejected") return "failed";
  if (a.status === "skipped") return "skipped";
  return null;
}
