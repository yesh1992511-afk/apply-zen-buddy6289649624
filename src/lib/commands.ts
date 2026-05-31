/**
 * Helpers that enqueue rows into public.worker_commands.
 * The Python worker polls this table every 5s and executes the command.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Kind = "scrape" | "apply" | "tailor" | "tailor_resume" | "compile_resume" | "test_source" | "test_run" | "notify_test";

async function enqueue(kind: Kind, payload: Record<string, unknown>): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) {
    toast.error("Not signed in");
    return null;
  }
  const { data, error } = await supabase
    .from("worker_commands")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({ user_id: u.user.id, kind, payload: payload as any })
    .select("id")
    .single();
  if (error) {
    toast.error(error.message);
    return null;
  }
  return data.id;
}

export async function triggerScrape(source_key: string) {
  const id = await enqueue("scrape", { source_key });
  if (id) toast.success(`Scraping "${source_key}" queued — worker will pick it up in <5s.`);
  return id;
}

export async function triggerApply(job_id: string) {
  const id = await enqueue("apply", { job_id });
  if (id) toast.success("Apply queued for the worker.");
  return id;
}

export async function triggerTailor(job_id: string) {
  const id = await enqueue("tailor", { job_id });
  if (id) toast.success("Tailored resume preview queued.");
  return id;
}

export async function triggerCompileResume(resume_id: string) {
  return enqueue("compile_resume", { resume_id });
}

export async function triggerTestSource(source_key: string) {
  const id = await enqueue("test_source", { source_key });
  if (id) toast.success(`Test fetch queued for "${source_key}".`);
  return id;
}

export async function triggerTestRun(source_key: string, match_limit: number) {
  const id = await enqueue("test_run", { source_key, match_limit });
  if (id) toast.success(`Test run queued: scrape until ${match_limit} matched, then auto-apply.`);
  return id;
}


/**
 * Get a same-origin blob: URL for a PDF in the `resumes` bucket.
 *
 * We proxy the bytes through our own server (via a TanStack server function)
 * instead of returning a Supabase Storage signed URL — ad blockers (Opera,
 * uBlock, AdBlock) often block the `*.supabase.co` subdomain and the PDF
 * preview fails with ERR_BLOCKED_BY_CLIENT. A blob: URL is same-origin and
 * cannot be blocked.
 */
export async function getResumePdfUrl(storage_path: string): Promise<string | null> {
  try {
    const { fetchResumePdfBase64 } = await import("@/lib/resumePdf.functions");
    const { base64 } = await fetchResumePdfBase64({ data: { storage_path } });
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("getResumePdfUrl failed", e);
    return null;
  }
}

/** Polls a command row until done/failed. On timeout, returns the last seen row (with status like "pending"/"running") so callers can distinguish worker-offline from compile-failed. */
export async function waitForCommand(id: string, timeoutMs = 120_000) {
  const start = Date.now();
  let last: { status: string | null; result: unknown; last_error: string | null } | null = null;
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from("worker_commands")
      .select("status, result, last_error")
      .eq("id", id)
      .maybeSingle();
    if (data) last = data;
    if (data?.status === "done" || data?.status === "failed") return data;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return last;
}

/** True if worker heartbeat is within the last 60s. */
export async function isWorkerOnline(): Promise<boolean> {
  const { data } = await supabase.from("worker_heartbeat").select("last_seen").maybeSingle();
  if (!data?.last_seen) return false;
  return Date.now() - new Date(data.last_seen).getTime() < 60_000;
}
