/**
 * Detect which ATS a job URL belongs to. Returns null for unsupported portals
 * (we mark those as needs_review for manual one-click apply).
 */
export type PortalKind = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'recruitee' | 'unknown';

export function detectPortal(url: string): PortalKind {
  if (!url) return 'unknown';
  const u = url.toLowerCase();
  if (u.includes('greenhouse.io') || u.includes('boards.greenhouse')) return 'greenhouse';
  if (u.includes('jobs.lever.co') || u.includes('lever.co')) return 'lever';
  if (u.includes('ashbyhq.com') || u.includes('jobs.ashbyhq')) return 'ashby';
  if (u.includes('workable.com')) return 'workable';
  if (u.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (u.includes('recruitee.com')) return 'recruitee';
  return 'unknown';
}
