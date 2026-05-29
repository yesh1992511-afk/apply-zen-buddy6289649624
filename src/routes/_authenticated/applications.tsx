import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — JobPilot" }] }),
  component: ApplicationsPage,
});

type App = {
  id: string;
  status: string;
  job_id: string;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  applied_at: string | null;
  job?: { title: string; company: string; url: string } | null;
};

const COLS = ["queued", "applying", "applied", "needs_review", "failed"] as const;

function ApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);

  useEffect(() => {
    supabase
      .from("applications")
      .select("id, status, job_id, attempts, last_error, queued_at, applied_at, job:jobs(title, company, url)")
      .order("queued_at", { ascending: false })
      .limit(300)
      .then(({ data }) => setApps((data ?? []) as unknown as App[]));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">Kanban view of every application the worker is processing.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {COLS.map((status) => {
          const items = apps.filter((a) => a.status === status);
          return (
            <Card key={status} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm capitalize">
                  {status.replace("_", " ")}
                  <Badge variant="secondary">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">Empty</p>}
                {items.map((a) => (
                  <div key={a.id} className="rounded-md border bg-card p-2 text-xs">
                    <div className="font-medium">{a.job?.title ?? "Job"}</div>
                    <div className="text-muted-foreground">{a.job?.company}</div>
                    {a.attempts > 0 && <div className="mt-1 text-[10px] text-muted-foreground">Attempts: {a.attempts}</div>}
                    {a.last_error && <div className="mt-1 text-[10px] text-destructive line-clamp-2">{a.last_error}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
