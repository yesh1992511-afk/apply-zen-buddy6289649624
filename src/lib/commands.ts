/**
 * Helpers that enqueue rows into public.worker_commands.
 * The Python worker polls this table every 5s and executes the command.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Kind = "scrape" | "apply" | "tailor" | "compile_resume" | "test_source";

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
  const id = await enqueue("compile_resume", { resume_id });
  if (id) toast.success("Compiling LaTeX → PDF…");
  return id;
}

export async function triggerTestSource(source_key: string) {
  const id = await enqueue("test_source", { source_key });
  if (id) toast.success(`Testing "${source_key}"…`);
  return id;
}

/** Get a short-lived signed URL for a resume PDF in the `resumes` bucket. */
export async function getResumePdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Polls a command row until done/failed, returns the final row. */
export async function waitForCommand(id: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from("worker_commands")
      .select("status, result, last_error")
      .eq("id", id)
      .maybeSingle();
    if (data?.status === "done" || data?.status === "failed") return data;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}
