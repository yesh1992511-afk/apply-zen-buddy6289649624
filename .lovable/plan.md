# Goal

Replace the thin one-paragraph system prompt in `src/lib/apply/ai.server.ts` (`generateTailoredResume`) with a rigorous ATS-strict prompt distilled from your uploaded `example prompt.docx`, so every tailored resume the worker generates follows your role-mapping, bullet-anatomy, anti-repetition, keyword-bolding, and validation rules.

Scope: prompt content + a small wrapper around it. No DB changes, no UI changes, no new tables, no new routes.

## What I'll change

### 1. `src/lib/apply/ai.server.ts` — rewrite `generateTailoredResume`

Keep the function signature (`profile`, `job` → markdown string) so the worker call sites don't change. Internally:

- New `SYSTEM_PROMPT` constant ≈ 70 lines, encoding the rules from your doc:
  - **Role**: ATS-strict resume optimizer; preserve candidate truth (no invented employers/dates/credentials).
  - **Title normalization**: most-recent role title rewritten to match JD target role (industry-standard equivalent, not copy-paste); prior roles one/two levels below where appropriate.
  - **Summary**: rephrased in candidate voice, 4–6 high-signal JD keywords wrapped in `**bold**`, no copying JD sentences.
  - **Experience**: exactly 7 bullets per role, each 25–35 words, one sentence, ≤2 commas / ≤1 "and" / ≤2 tool mentions, no parens/em-dashes, ≥1 numeric metric per bullet, first bullet describes system/team/goal/role.
  - **Bullet anatomy**: `[Action verb] + [initiative + scope] + [tools] + [core action] + [risk addressed] + [quantified impact]`.
  - **Coverage lenses** (rotate across bullets in a role): latency/scale, data quality, platform/IaC, modeling/marts, streaming, orchestration/observability, security/governance.
  - **Anti-repetition**: unique first verb + two-word opener per bullet within a role; no repeated tri-grams; banned scaffolds ("Integrated data from…", "Set up, deployed, and configured…", "Provided management reporting…", "Created innovative solutions…") allowed at most once per role.
  - **Action verb bank** embedded verbatim from doc.
  - **Skills**: keep existing; append JD-required tools; group by category; no duplicates; no proprietary tools.
  - **Projects**: reframe rather than replace when partially aligned; descriptive original names; never copy JD product names.
  - **Keyword bolding**: wrap each exact JD term in `**…**` on first appearance in each section; cap at 3–4 repetitions resume-wide; never bold soft skills/generic verbs.
  - **Realism guardrails**: don't invent tools/certs/clearances; preserve years of experience; flag visa/clearance/geo conflicts inline at top with `<!-- GUARDRAIL: … -->` instead of silently proceeding.
  - **Validation pass** the model must self-run before emitting: bullet counts, word range, unique openers, no tri-gram repeats, ≥1 metric + ≥1 JD tool per bullet, ≥6 quantified achievements total, all high-priority JD keywords bolded ≥once.
  - **Output**: Markdown only, name as H1, no commentary, no code fences around the whole resume.

- Keep the user message as today (target job block + JSON profile dump), with the JD slice raised from 4000 → 6000 chars so keyword coverage is fairer.

- Model: keep `google/gemini-2.5-pro` for tailored resumes; it handles the long rule set best.

### 2. Leave `generateCoverLetter` alone

Your doc is resume-specific; cover-letter prompt stays as-is.

### 3. No call-site changes

`apply-worker.ts` and anywhere else that calls `generateTailoredResume(profile, job)` keep working unchanged.

## Out of scope (ask if you want these next)

- LaTeX path: your doc references `.tex` preamble preservation. Current worker generates **Markdown** resumes (then renders to PDF elsewhere). Adding a LaTeX-preserving path would need a new function + a stored LaTeX template per user. I can add that as a follow-up if you want.
- "remember this structure" command: would need a `resume_templates` table to store the verbatim LaTeX. Follow-up.
- A UI control to preview/regenerate with the new prompt — current admin "test_apply" worker command already covers this once shipped.

## Verification after build

1. From `/admin` → System → Command Center, dispatch `test_apply` against a known job.
2. Open the generated resume in `/applications/:id` and confirm: 7-bullet roles, bolded JD terms, numeric metric per bullet, no banned scaffolds.

## Files touched

- `src/lib/apply/ai.server.ts` (only `generateTailoredResume` body + new prompt constant)
