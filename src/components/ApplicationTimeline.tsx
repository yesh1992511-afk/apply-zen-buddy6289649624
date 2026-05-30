import { useState } from "react";
import { Camera, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import type { ApplicationEvent } from "@/lib/queries/applications";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function phaseColor(status: string | null) {
  if (!status) return "bg-muted-foreground/40";
  if (status === "ok" || status === "success") return "bg-success";
  if (status === "error" || status === "failed") return "bg-destructive";
  if (status === "warn") return "bg-warning";
  return "bg-primary";
}

function phaseIcon(status: string | null) {
  if (status === "ok" || status === "success") return CheckCircle2;
  if (status === "error" || status === "failed") return AlertCircle;
  return Loader2;
}

export function ApplicationTimeline({ events }: { events: ApplicationEvent[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        No timeline events yet — the worker hasn't started this application.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/40 px-4 py-2.5">
        <h3 className="text-sm font-semibold">Timeline</h3>
        <p className="text-[11px] text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
        </p>
      </div>
      <ol className="relative space-y-1 p-4">
        {events.map((e, i) => {
          const Icon = phaseIcon(e.status);
          return (
            <li key={e.id} className="relative flex gap-3 pl-1">
              {i < events.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[10px] top-6 h-[calc(100%-12px)] w-px bg-border/50"
                />
              )}
              <div
                className={cn(
                  "relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  phaseColor(e.status),
                )}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
                    {e.phase}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {timeAgo(e.ts)}
                  </span>
                </div>
                {e.message && (
                  <p className="mt-0.5 text-sm text-foreground/90">{e.message}</p>
                )}
                {e.screenshot_path && (
                  <button
                    type="button"
                    onClick={() => setLightbox(e.screenshot_path)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border/50 bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50"
                  >
                    <Camera className="h-3 w-3" />
                    View screenshot
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {lightbox && <ScreenshotPreview path={lightbox} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScreenshotPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  if (!url) {
    supabase.storage
      .from("screenshots")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null))
      .catch(() => setUrl(null));
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <img src={url} alt="Worker screenshot" className="w-full rounded-md" />;
}
