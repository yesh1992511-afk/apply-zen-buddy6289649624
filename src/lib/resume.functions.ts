import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderResumeTex, type ResumeData } from "./resume-render.server";
import { slugifyName } from "./resume-template";

/**
 * Build a synced .tex from the user's profile, upload to storage, insert resume row.
 * Versioned as <slug>_v1.tex, <slug>_v2.tex, ...
 * Requires >=80% completion (per the profile-page hard gate).
 */
export const syncResumeFromProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, expRes, projRes, skillRes, certRes, eduRes, pubRes] = await Promise.all([
      supabase.from("profile").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("experiences").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("projects").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("skills").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("certifications").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("educations").select("*").eq("user_id", userId).order("sort_order"),
      supabase.from("publications").select("*").eq("user_id", userId).order("sort_order"),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);
    if (!profileRes.data) throw new Error("Profile not found");

    const data: ResumeData = {
      profile: profileRes.data as ResumeData["profile"],
      experiences: (expRes.data ?? []) as ResumeData["experiences"],
      projects: (projRes.data ?? []) as ResumeData["projects"],
      skills: (skillRes.data ?? []) as ResumeData["skills"],
      certifications: (certRes.data ?? []) as ResumeData["certifications"],
      educations: (eduRes.data ?? []) as ResumeData["educations"],
      publications: (pubRes.data ?? []) as ResumeData["publications"],
    };

    const tex = renderResumeTex(data);
    const prof = data.profile as ResumeData["profile"] & { first_name?: string | null; last_name?: string | null };
    const composed = [prof.first_name, prof.last_name].filter(Boolean).join(" ").trim();
    const slug = slugifyName(composed || prof.full_name || "resume");

    // Determine next version
    const { data: existing } = await supabase
      .from("resumes")
      .select("name")
      .eq("user_id", userId)
      .eq("kind", "synced")
      .like("name", `${slug}_v%`);
    let maxV = 0;
    for (const r of existing ?? []) {
      const m = /_v(\d+)$/.exec((r as { name: string }).name);
      if (m) maxV = Math.max(maxV, Number(m[1]));
    }
    const nextV = maxV + 1;
    const baseName = `${slug}_v${nextV}`;
    const storagePath = `${userId}/${baseName}.tex`;

    const { error: upErr } = await supabase.storage
      .from("resumes")
      .upload(storagePath, new Blob([tex], { type: "application/x-tex" }), {
        contentType: "application/x-tex",
        upsert: true,
      });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    // Unset previous defaults among synced resumes
    await supabase
      .from("resumes")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("kind", "synced");

    const { data: inserted, error: insErr } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        kind: "synced",
        name: baseName,
        tex_content: tex,
        storage_path: storagePath,
        is_default: true,
      })
      .select("id, name")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { id: inserted.id, name: inserted.name, storage_path: storagePath };
  });

/**
 * Compile a resume's .tex into PDF via latexonline.cc and return base64.
 * The browser turns it into a download. We don't persist the PDF — re-compile
 * on demand keeps things simple.
 */
export const compileResumeToPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ resume_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("resumes")
      .select("id, name, tex_content")
      .eq("id", data.resume_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) { console.error("[server-fn] supabase error", error); throw new Error("Request failed"); }
    if (!row || !row.tex_content) throw new Error("Resume .tex not found");

    // latexonline.cc compiles .tex → PDF. Free, no key required.
    // POST text body works for larger documents than the GET endpoint.
    const url = `https://latexonline.cc/data?command=pdflatex&text=${encodeURIComponent(row.tex_content)}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      // Log the raw upstream response server-side only; never forward to the client.
      const errText = await res.text().catch(() => "");
      console.error("[compileResumeToPdf] latexonline error", res.status, errText.slice(0, 1000));
      throw new Error("PDF compilation failed. Check the LaTeX source for errors.");
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 200) {
      throw new Error("Compile returned an empty PDF");
    }
    const base64 = Buffer.from(ab).toString("base64");
    return { name: `${row.name}.pdf`, base64 };
  });
