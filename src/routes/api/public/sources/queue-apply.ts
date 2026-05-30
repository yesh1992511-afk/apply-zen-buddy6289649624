import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { createHash } from "crypto";

const cors: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const JobSchema = z.object({
  title: z.string().min(1).max(500),
  company: z.string().min(1).max(255),
  url: z.string().url().max(2000),
  location: z.string().max(500).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  source: z.string().min(1).max(50),
});

const BodySchema = z.object({ job: JobSchema });

/**
 * POST /api/public/sources/queue-apply
 * Called by the extension's "Apply via JobPilot" button.
 * Upserts the job and inserts an application row with status='queued'.
 * The VPS worker picks it up on the next apply tick.
 */
export const Route = createFileRoute("/api/public/sources/queue-apply")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!token || token.length < 16) {
          return new Response(JSON.stringify({ error: "missing_token" }), { status: 401, headers: cors });
        }
        const { data: tok } = await supabaseAdmin
          .from("extension_tokens")
          .select("user_id")
          .eq("token", token)
          .maybeSingle();
        if (!tok) {
          return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: cors });
        }
        const userId = tok.user_id as string;

        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: cors });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_body", details: parsed.error.flatten() }), { status: 400, headers: cors });
        }
        const { job } = parsed.data;
        const source_key = `ext_${job.source}`;
        const source_job_id = createHash("sha1").update(job.url).digest("hex").slice(0, 32);
        const dedupe_hash = createHash("sha1")
          .update([userId, source_key, source_job_id, job.title.toLowerCase().trim(), job.company.toLowerCase().trim()].join("|"))
          .digest("hex");

        // Upsert job
        const { data: existing } = await supabaseAdmin
          .from("jobs")
          .select("id")
          .eq("user_id", userId)
          .eq("dedupe_hash", dedupe_hash)
          .maybeSingle();

        let jobId: string;
        if (existing) {
          jobId = existing.id as string;
          await supabaseAdmin.from("jobs").update({ status: "matched", matched: true }).eq("id", jobId);
        } else {
          const { data: ins, error: insErr } = await supabaseAdmin.from("jobs").insert({
            user_id: userId,
            source_key,
            source_job_id,
            dedupe_hash,
            title: job.title,
            company: job.company,
            url: job.url,
            location: job.location ?? null,
            description: job.description ?? null,
            scraped_at: new Date().toISOString(),
            status: "matched",
            matched: true,
            score: 90,
            raw: { via: "extension_apply_button" } as never,
          }).select("id").single();
          if (insErr || !ins) {
            return new Response(JSON.stringify({ error: "job_insert_failed", details: insErr?.message }), { status: 500, headers: cors });
          }
          jobId = ins.id as string;
        }

        // Dedupe application row
        const { data: existingApp } = await supabaseAdmin
          .from("applications")
          .select("id, status")
          .eq("user_id", userId)
          .eq("job_id", jobId)
          .maybeSingle();
        if (existingApp) {
          return new Response(JSON.stringify({ ok: true, job_id: jobId, application_id: existingApp.id, already: true }), { status: 200, headers: cors });
        }

        const { data: app, error: appErr } = await supabaseAdmin
          .from("applications")
          .insert({ user_id: userId, job_id: jobId, status: "queued" })
          .select("id")
          .single();
        if (appErr) {
          return new Response(JSON.stringify({ error: "queue_failed", details: appErr.message }), { status: 500, headers: cors });
        }

        await supabaseAdmin.from("extension_tokens").update({ last_seen_at: new Date().toISOString() }).eq("token", token);

        return new Response(JSON.stringify({ ok: true, job_id: jobId, application_id: app?.id }), { status: 200, headers: cors });
      },
    },
  },
});
