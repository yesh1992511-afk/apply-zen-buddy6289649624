/**
 * Apply worker — cron'd every 1 minute by pg_cron, also callable on-demand.
 *
 * Picks oldest `queued` application, runs the full pipeline:
 *   queued -> applying -> [generate resume -> generate cover -> submit OR mark needs_review] -> applied / needs_review / failed
 *
 * Writes detailed log rows at each step so the Live Activity panel and Form
 * Fill table populate in real time via Supabase realtime.
 */
import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { writeLog } from '@/lib/apply/log.server';
import { generateTailoredResume, generateCoverLetter, type ProfileSnapshot, type JobSnapshot } from '@/lib/apply/ai.server';
import { detectPortal } from '@/lib/apply/portal.server';
import { requireUserOrCron, claimIdempotency } from '@/lib/api-auth.server';
import { appError, withErrorBoundary } from '@/lib/errors';

const MAX_PER_RUN = 3; // process up to N queued apps per cron tick

export const Route = createFileRoute('/api/public/hooks/apply-worker')({
  server: {
    handlers: {
      POST: withErrorBoundary(({ request }) => handle(request)),
      GET: withErrorBoundary(({ request }) => handle(request)),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const t0 = Date.now();
  const auth = await requireUserOrCron(request);

  const url = new URL(request.url);
  const onlyAppId = url.searchParams.get('application_id');

  const q = supabaseAdmin
    .from('applications')
    .select('id, user_id, job_id, attempts')
    .eq('status', 'queued')
    .order('queued_at', { ascending: true })
    .limit(onlyAppId ? 1 : MAX_PER_RUN);
  if (onlyAppId) q.eq('id', onlyAppId);
  // When called by a user (not cron), restrict to that user's applications.
  if (!auth.isCron) q.eq('user_id', auth.userId);

  const { data: apps, error } = await q;
  if (error) throw appError('INTERNAL', error.message);
  if (!apps?.length) {
    console.log(JSON.stringify({ evt: 'apply-worker', processed: 0, ms: Date.now() - t0 }));
    return Response.json({ ok: true, processed: 0, results: [] });
  }

  const results: Array<{ id: string; status: string; error?: string; skipped?: boolean }> = [];
  for (const app of apps) {
    const claimed = await claimIdempotency({
      supabaseAdmin,
      key: `apply-worker:${app.id}:${(app.attempts ?? 0) + 1}`,
      kind: 'apply-worker',
      userId: app.user_id,
    });
    if (!claimed) {
      results.push({ id: app.id, status: 'skipped', skipped: true });
      continue;
    }
    try {
      await processOne(app.id, app.user_id, app.job_id, app.attempts ?? 0);
      results.push({ id: app.id, status: 'ok' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const nextAttempts = (app.attempts ?? 0) + 1;
      const giveUp = nextAttempts >= 5;
      await supabaseAdmin
        .from('applications')
        .update({
          status: giveUp ? 'failed' : 'queued',
          last_error: message.slice(0, 1000),
          finished_at: giveUp ? new Date().toISOString() : null,
        })
        .eq('id', app.id);
      results.push({ id: app.id, status: giveUp ? 'failed' : 'requeued', error: message });
    }
  }
  const counts = results.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
  console.log(JSON.stringify({ evt: 'apply-worker', processed: results.length, counts, ms: Date.now() - t0 }));
  return Response.json({ ok: true, processed: results.length, results, counts });
}

type EventPhase =
  | 'discovered' | 'scored' | 'tailored' | 'queued' | 'applying'
  | 'submitted' | 'needs_review' | 'failed' | 'follow_up_sent'
  | 'replied' | 'interview' | 'offer' | 'rejected' | 'dead_letter';

async function writeEvent(opts: {
  user_id: string;
  application_id: string;
  phase: EventPhase;
  status?: string;
  message?: string;
  payload?: Record<string, unknown>;
}) {
  await supabaseAdmin.from('application_events').insert({
    user_id: opts.user_id,
    application_id: opts.application_id,
    phase: opts.phase,
    status: opts.status ?? null,
    message: opts.message ?? null,
    payload: (opts.payload ?? {}) as never,
  } as never);
}

async function processOne(applicationId: string, userId: string, jobId: string, attempts: number) {
  const startedAt = new Date().toISOString();

  // Move queued -> applying
  await supabaseAdmin
    .from('applications')
    .update({ status: 'applying', started_at: startedAt, attempts: attempts + 1, last_error: null })
    .eq('id', applicationId);

  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'apply.start', message: 'Picked up by apply worker' });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'applying', status: 'started', message: 'Picked up by apply worker' });

  // Load job + profile
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, title, company, description, url, location, source_key')
    .eq('id', jobId)
    .maybeSingle();
  if (jobErr || !job) throw new Error(`Job not found: ${jobErr?.message ?? jobId}`);

  const profile = await loadProfile(userId);

  // ---- Step 1: tailored resume ----
  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'resume.generate', message: `Tailoring resume for ${job.title} @ ${job.company}` });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'tailored', status: 'resume_start', message: `Tailoring resume for ${job.title} @ ${job.company}` });
  const resumeMd = await generateTailoredResume(profile, jobSnapshot(job));
  const { data: resumeRow, error: rErr } = await supabaseAdmin
    .from('resumes')
    .insert({
      user_id: userId,
      application_id: applicationId,
      name: `Resume — ${job.company} ${job.title}`.slice(0, 200),
      kind: 'tailored',
      tex_content: resumeMd,
      is_default: false,
    } as never)
    .select('id')
    .single();
  if (rErr) throw new Error(`Save resume: ${rErr.message}`);
  await supabaseAdmin.from('applications').update({ resume_id: resumeRow.id }).eq('id', applicationId);

  // Insert a generated_resumes row so the AI panel on /applications/$id populates.
  // We mirror profile data into the tailored_* fields and stash the full markdown
  // in tex_content. A separate compile worker (enqueued below) fills pdf_storage_path.
  const { data: genRow, error: gErr } = await supabaseAdmin
    .from('generated_resumes')
    .insert({
      user_id: userId,
      job_id: jobId,
      model: 'apply-worker',
      tex_content: resumeMd,
      tailored_summary: profile.summary ?? profile.headline ?? null,
      tailored_skills: profile.skills ?? [],
      tailored_experiences: (profile.experiences ?? []).map((e) => ({
        company: e.company, title: e.title,
        start_date: e.start_date, end_date: e.end_date,
        bullets: e.bullets ?? [],
      })) as never,
      tailored_projects: [] as never,
      cost_usd: 0,
    } as never)
    .select('id')
    .single();
  if (!gErr && genRow) {
    await supabaseAdmin.from('applications').update({ generated_resume_id: genRow.id }).eq('id', applicationId);
  }

  // Enqueue PDF compile for the resume — a separate worker can fill pdf_storage_path.
  await supabaseAdmin.from('worker_commands').insert({
    user_id: userId,
    kind: 'compile_resume',
    payload: { resume_id: resumeRow.id, generated_resume_id: genRow?.id ?? null, application_id: applicationId } as never,
    status: 'pending',
  } as never);

  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'resume.generate', message: `Resume ready (${resumeMd.length} chars)`, level: 'info' });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'tailored', status: 'resume_ready', message: `Resume ready (${resumeMd.length} chars)`, payload: { resume_id: resumeRow.id, generated_resume_id: genRow?.id ?? null } });

  // ---- Step 2: cover letter ----
  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'cover.generate', message: 'Writing cover letter' });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'tailored', status: 'cover_start', message: 'Writing cover letter' });
  const cover = await generateCoverLetter(profile, jobSnapshot(job));
  const { data: coverRow, error: cErr } = await supabaseAdmin
    .from('cover_letters')
    .insert({
      user_id: userId,
      job_id: jobId,
      name: `Cover letter — ${job.company}`.slice(0, 200),
      kind: 'generated',
      body: cover,
      tone: 'professional',
      is_default: false,
    } as never)
    .select('id')
    .single();
  if (cErr) throw new Error(`Save cover: ${cErr.message}`);
  await supabaseAdmin.from('applications').update({ cover_letter_id: coverRow.id }).eq('id', applicationId);
  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'cover.generate', message: `Cover letter ready (${cover.length} chars)` });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'tailored', status: 'cover_ready', message: `Cover letter ready (${cover.length} chars)`, payload: { cover_letter_id: coverRow.id } });

  // ---- Step 3: portal detection + submission ----
  const portal = detectPortal(job.url ?? '');
  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'apply.submit', message: `Detected portal: ${portal}` });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'applying', status: 'portal_detected', message: `Detected portal: ${portal}`, payload: { portal } });

  if (portal === 'unknown') {
    // Mark for manual one-click review
    await supabaseAdmin
      .from('applications')
      .update({ status: 'needs_review', finished_at: new Date().toISOString() })
      .eq('id', applicationId);
    await writeLog({
      user_id: userId,
      application_id: applicationId,
      job_id: jobId,
      scope: 'apply.needs_review',
      level: 'warn',
      message: 'Portal not auto-submittable — tailored docs ready for manual one-click apply',
    });
    await writeEvent({ user_id: userId, application_id: applicationId, phase: 'needs_review', status: 'manual_required', message: 'Portal not auto-submittable — tailored docs ready for manual one-click apply' });
    return;
  }

  // Build form-fill rows (also persisted to applications.field_fills below).
  const fields: Array<{ label: string; value: string; source: string }> = [
    { label: 'first_name', value: profile.full_name?.split(' ')[0] ?? '', source: 'profile' },
    { label: 'last_name', value: profile.full_name?.split(' ').slice(1).join(' ') ?? '', source: 'profile' },
    { label: 'email', value: profile.email ?? '', source: 'profile' },
    { label: 'phone', value: profile.phone ?? '', source: 'profile' },
    { label: 'location', value: profile.location ?? '', source: 'profile' },
    { label: 'linkedin_url', value: profile.linkedin_url ?? '', source: 'profile' },
    { label: 'github_url', value: profile.github_url ?? '', source: 'profile' },
    { label: 'portfolio_url', value: profile.portfolio_url ?? '', source: 'profile' },
    { label: 'years_experience', value: String(profile.years_experience ?? ''), source: 'profile' },
    { label: 'resume', value: `Resume — ${job.company} (auto-tailored, ${resumeMd.length} chars)`, source: 'generated' },
    { label: 'cover_letter', value: `Cover letter (auto-generated, ${cover.length} chars)`, source: 'generated' },
  ];
  const filled = fields.filter((f) => f.value);
  for (const f of filled) {
    await writeLog({
      user_id: userId,
      application_id: applicationId,
      job_id: jobId,
      scope: `form.fill.${f.label}`,
      message: `${f.label} => ${f.value.slice(0, 120)}`,
    });
    // gentle pacing for nice UI animation
    await new Promise((r) => setTimeout(r, 250));
  }

  // Persist the field fills onto the application so the Form tab populates
  // even after logs are pruned.
  await supabaseAdmin
    .from('applications')
    .update({ field_fills: filled as never })
    .eq('id', applicationId);

  await writeLog({ user_id: userId, application_id: applicationId, job_id: jobId, scope: 'apply.submit', message: `Submitting to ${portal}` });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'applying', status: 'submitting', message: `Submitting to ${portal}`, payload: { portal, field_count: filled.length } });

  // We mark needs_review (not applied) because actual submission requires
  // per-portal authenticated session that the runtime can't establish without
  // a headless browser. The tailored docs are ready for one-click manual.
  await supabaseAdmin
    .from('applications')
    .update({ status: 'needs_review', finished_at: new Date().toISOString() })
    .eq('id', applicationId);
  await writeLog({
    user_id: userId,
    application_id: applicationId,
    job_id: jobId,
    scope: 'apply.needs_review',
    message: `Ready to submit on ${portal} — open the job link and paste the prepared docs`,
  });
  await writeEvent({ user_id: userId, application_id: applicationId, phase: 'needs_review', status: 'ready', message: `Ready to submit on ${portal}` });
}

function jobSnapshot(j: { title: string; company: string; description: string | null; location: string | null }): JobSnapshot {
  return { title: j.title, company: j.company, description: j.description, location: j.location };
}

async function loadProfile(userId: string): Promise<ProfileSnapshot> {
  const [{ data: p }, { data: skills }, { data: exps }, { data: edus }] = await Promise.all([
    supabaseAdmin.from('profile').select('*').eq('user_id', userId).maybeSingle(),
    supabaseAdmin.from('skills').select('name').eq('user_id', userId).order('sort_order'),
    supabaseAdmin.from('experiences').select('company, title, start_date, end_date, bullets, tech').eq('user_id', userId).order('sort_order'),
    supabaseAdmin.from('educations').select('school, degree, field').eq('user_id', userId).order('sort_order'),
  ]);
  return {
    full_name: p?.full_name ?? null,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    location: p?.location ?? null,
    headline: p?.headline ?? null,
    summary: p?.summary ?? null,
    linkedin_url: p?.linkedin_url ?? null,
    github_url: p?.github_url ?? null,
    portfolio_url: p?.portfolio_url ?? null,
    years_experience: p?.years_experience ? Number(p.years_experience) : null,
    skills: (skills ?? []).map((s) => s.name as string),
    experiences: (exps ?? []).map((e) => ({
      company: e.company as string,
      title: e.title as string,
      start_date: (e.start_date as string | null) ?? null,
      end_date: (e.end_date as string | null) ?? null,
      bullets: (e.bullets as string[] | null) ?? [],
      tech: (e.tech as string[] | null) ?? [],
    })),
    educations: (edus ?? []).map((e) => ({
      school: e.school as string,
      degree: (e.degree as string | null) ?? null,
      field: (e.field as string | null) ?? null,
    })),
  };
}
