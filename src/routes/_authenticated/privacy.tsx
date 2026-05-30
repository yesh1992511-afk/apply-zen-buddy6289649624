import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exportMyData, requestAccountDeletion, cancelAccountDeletion, getDeletionStatus } from "@/lib/privacy.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Download, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/privacy")({
  head: () => ({ meta: [{ title: "Privacy & Data — JobPilot" }] }),
  component: PrivacyPage,
  errorComponent: ErrorBoundaryRoute,
});

function PrivacyPage() {
  const doExport = useServerFn(exportMyData);
  const doRequestDelete = useServerFn(requestAccountDeletion);
  const doCancelDelete = useServerFn(cancelAccountDeletion);
  const getStatus = useServerFn(getDeletionStatus);
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getStatus().then(setStatus); }, []);

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await doExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `jobpilot-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export downloaded");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Schedule account deletion in 30 days? You can cancel anytime before then.")) return;
    setBusy(true);
    try {
      await doRequestDelete({ data: {} });
      getStatus().then(setStatus);
      toast.success("Deletion scheduled");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await doCancelDelete();
      getStatus().then(setStatus);
      toast.success("Deletion cancelled");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const pendingDeletion = status && !status.cancelled_at;

  return (
    <div className="space-y-6 max-w-[800px]">
      <PageHeader title="Privacy & data rights" description="Export or delete your data. GDPR-aligned." />

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-heading text-base font-semibold flex items-center gap-2"><Download className="h-4 w-4" /> Export all data</h3>
        <p className="mt-1 text-xs text-muted-foreground">Download a JSON archive of every record we hold for your account: profile, jobs, applications, events, settings, logs.</p>
        <Button className="mt-3" size="sm" onClick={handleExport} disabled={busy}>Download export</Button>
      </div>

      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <h3 className="font-heading text-base font-semibold flex items-center gap-2 text-destructive"><ShieldAlert className="h-4 w-4" /> Delete account</h3>
        <p className="mt-1 text-xs text-muted-foreground">Deletion is scheduled 30 days out — purge happens then. You can cancel anytime in this window.</p>
        {pendingDeletion ? (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-background/50 px-3 py-2 text-xs">
            <span>Deletion scheduled for <strong className="tabular-nums">{new Date(status.purge_after).toLocaleDateString()}</strong></span>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={busy}><Undo2 className="mr-1.5 h-3 w-3" />Cancel deletion</Button>
          </div>
        ) : (
          <Button className="mt-3" size="sm" variant="destructive" onClick={handleDelete} disabled={busy}>Schedule deletion</Button>
        )}
      </div>
    </div>
  );
}
