/**
 * Fetch a resume PDF as base64 through the app server, so the browser never
 * has to load it directly from the Supabase Storage subdomain (which ad
 * blockers like Opera/uBlock often block, causing ERR_BLOCKED_BY_CLIENT).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ storage_path: z.string().min(1).max(500) });

export const fetchResumePdfBase64 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: confirm the path belongs to a resume row owned by this user.
    const { data: row, error: rowErr } = await supabase
      .from("resumes")
      .select("id")
      .eq("user_id", userId)
      .eq("pdf_storage_path", data.storage_path)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("Resume not found");

    const { data: blob, error } = await supabase.storage
      .from("resumes")
      .download(data.storage_path);
    if (error || !blob) throw new Error(error?.message ?? "Download failed");

    const buf = Buffer.from(await blob.arrayBuffer());
    return { base64: buf.toString("base64") };
  });
