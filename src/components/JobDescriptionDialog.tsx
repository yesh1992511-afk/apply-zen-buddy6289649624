import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, ExternalLink, Send, Clock, DollarSign } from "lucide-react";
import { PortalBadge } from "@/components/PortalBadge";
import { timeAgo, sanitizeHtml } from "@/lib/timeAgo";

function decodeEntities(str: string): string {
  if (!str || !/&(?:lt|gt|amp|quot|#\d+|#x[0-9a-f]+);/i.test(str)) return str;
  const named: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in named ? named[n] : m));
}

export type JobDialogJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  url: string;
  source_key: string;
  posted_at: string | null;
  scraped_at: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  employment_type: string | null;
  seniority: string | null;
  description: string | null;
  description_html: string | null;
};

export function JobDescriptionDialog({
  job,
  open,
  onOpenChange,
  onApply,
  applying,
}: {
  job: JobDialogJob | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (j: JobDialogJob) => void;
  applying?: boolean;
}) {
  if (!job) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="font-heading text-xl leading-tight">{job.title}</DialogTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}{job.remote ? ` · ${job.remote}` : ""}</span>}
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Posted {timeAgo(job.posted_at ?? job.scraped_at)}</span>
              </div>
            </div>
            <PortalBadge source={job.source_key} size="sm" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {job.seniority && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium">{job.seniority}</span>}
            {job.employment_type && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium">{job.employment_type}</span>}
            {(job.salary_min || job.salary_max) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 text-gold px-2.5 py-0.5 text-[11px] font-medium tabular-nums">
                <DollarSign className="h-3 w-3" />{job.salary_currency ?? "$"}{job.salary_min ?? "?"}–{job.salary_max ?? "?"}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-lg border border-border/50 bg-surface-1/40 p-4 text-sm leading-relaxed">
          {job.description_html ? (
            <div
              className="prose prose-sm prose-invert max-w-none [&_a]:text-primary [&_h1,&_h2,&_h3]:font-heading [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description_html) }}
            />
          ) : job.description ? (
            <div className="whitespace-pre-wrap text-foreground/90">{job.description}</div>
          ) : (
            <p className="italic text-muted-foreground">No description available for this posting.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <Button asChild variant="outline" size="sm">
            <a href={job.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />View original posting</a>
          </Button>
          <Button onClick={() => onApply(job)} disabled={applying} className="bg-gradient-emerald gap-1.5 shadow-glow">
            <Send className="h-4 w-4" />{applying ? "Queuing…" : "Apply now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
