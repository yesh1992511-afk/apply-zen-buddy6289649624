/**
 * Cover letter CRUD + AI generation.
 * Templates are kind='template', AI-generated-per-job are kind='generated'.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateCoverLetter, type JobSnapshot, type ProfileSnapshot } from "@/lib/apply/ai.server";

export type CoverLetterRow = {
  id: string;
  name: string;
  kind: "template" | "generated";
  body: string;
  job_id: string | null;
  tone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export const listCoverLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoverLetterRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("cover_letters")
      .select("id,name,kind,body,job_id,tone,is_default,created_at,updated_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CoverLetterRow[];
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  body: z.string().max(20_000),
  tone: z.string().max(40).optional(),
  is_default: z.boolean().optional(),
});

export const upsertCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.is_default) {
      await supabase.from("cover_letters").update({ is_default: false }).eq("user_id", userId);
    }
    if (data.id) {
      const { error } = await supabase
        .from("cover_letters")
        .update({
          name: data.name,
          body: data.body,
          tone: data.tone ?? "professional",
          is_default: data.is_default ?? false,
        })
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("cover_letters")
      .insert({
        user_id: userId,
        name: data.name,
        body: data.body,
        tone: data.tone ?? "professional",
        is_default: data.is_default ?? false,
        kind: "template",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("cover_letters")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultCoverLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("cover_letters").update({ is_default: false }).eq("user_id", userId);
    const { error } = await supabase
      .from("cover_letters")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GenerateInput = z.object({
  jobId: z.string().uuid(),
  tone: z.string().max(40).optional(),
  save: z.boolean().optional(),
});

export const generateCoverLetterForJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: job }, { data: prof }, { data: skills }, { data: exps }, { data: edus }] = await Promise.all([
      supabase.from("jobs").select("title,company,description,location").eq("id", data.jobId).eq("user_id", userId).maybeSingle(),
      supabase.from("profile").select("full_name,email,phone,location,headline,summary,linkedin_url,github_url,portfolio_url,years_experience").eq("user_id", userId).maybeSingle(),
      supabase.from("skills").select("name").eq("user_id", userId).limit(40),
      supabase.from("experiences").select("company,title,start_date,end_date,bullets,tech").eq("user_id", userId).order("sort_order", { ascending: true }).limit(5),
      supabase.from("educations").select("school,degree,field").eq("user_id", userId).limit(3),
    ]);

    if (!job) throw new Error("Job not found");
    if (!prof) throw new Error("Complete your profile first");

    const profileSnap: ProfileSnapshot = {
      full_name: prof.full_name ?? null,
      email: prof.email ?? null,
      phone: prof.phone ?? null,
      location: prof.location ?? null,
      headline: prof.headline ?? null,
      summary: prof.summary ?? null,
      linkedin_url: prof.linkedin_url ?? null,
      github_url: prof.github_url ?? null,
      portfolio_url: prof.portfolio_url ?? null,
      years_experience: prof.years_experience ?? null,
      skills: (skills ?? []).map((s) => s.name),
      experiences: (exps ?? []).map((e) => ({
        company: e.company,
        title: e.title,
        start_date: e.start_date,
        end_date: e.end_date,
        bullets: e.bullets ?? [],
        tech: e.tech ?? [],
      })),
      educations: (edus ?? []).map((e) => ({ school: e.school, degree: e.degree, field: e.field })),
    };

    const jobSnap: JobSnapshot = {
      title: job.title,
      company: job.company,
      description: job.description ?? null,
      location: job.location ?? null,
    };

    const body = await generateCoverLetter(profileSnap, jobSnap, data.tone ?? "professional");

    let savedId: string | null = null;
    if (data.save !== false) {
      const { data: row, error } = await supabase
        .from("cover_letters")
        .insert({
          user_id: userId,
          name: `${job.company} — ${job.title}`,
          kind: "generated",
          body,
          job_id: data.jobId,
          tone: data.tone ?? "professional",
          is_default: false,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      savedId = row.id;
    }

    return { body, id: savedId };
  });
