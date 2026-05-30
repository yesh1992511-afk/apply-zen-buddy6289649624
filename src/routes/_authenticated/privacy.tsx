import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  exportMyData,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
} from "@/lib/privacy.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, ShieldAlert, Undo2 } from "lucide-react";
import { toastError, toastSaved } from "@/lib/toast";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/_authenticated/privacy")({
  head: () => ({ meta: [{ title: "Privacy & Data — JobPilot" }] }),
  component: PrivacyPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

type DeletionStatus = {
  purge_after: string;
  cancelled_at: string | null;
  reason: string | null;
} | null;

function PrivacyPage() {
  const doExport = useServerFn(exportMyData);
  const doRequestDelete = useServerFn(requestAccountDeletion);
  const doCancelDelete = useServerFn(cancelAccountDeletion);
  const getStatus = useServerFn(getDeletionStatus);
  const [status, setStatus] = useState<DeletionStatus>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getStatus().then((s) => setStatus(s as DeletionStatus));
  }, [getStatus]);

  const handleExport = async () => {
    setBusy(true);
    try {
      const data = await doExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `jobpilot-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toastSaved("Export downloaded");
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await doRequestDelete({ data: {} });
      const s = await getStatus();
      setStatus(s as DeletionStatus);
      toastSaved("Deletion scheduled");
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await doCancelDelete();
      const s = await getStatus();
      setStatus(s as DeletionStatus);
      toastSaved("Deletion cancelled");
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const pendingDeletion = !!(status && !status.cancelled_at);

  return (
    <div className="space-y-6 max-w-[800px]">
      <PageHeader
        title="Privacy & data rights"
        description="Export or delete your data. GDPR-aligned."
      />

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-heading text-base font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> Export all data
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Download a JSON archive of every record we hold for your account: profile, jobs,
          applications, events, settings, logs.
        </p>
        <Button className="mt-3" size="sm" onClick={handleExport} disabled={busy}>
          Download export
        </Button>
      </div>

      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <h3 className="font-heading text-base font-semibold flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-4 w-4" /> Delete account
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Deletion is scheduled 30 days out — purge happens then. You can cancel anytime in this
          window.
        </p>
        {pendingDeletion && status ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-background/50 px-3 py-2 text-xs">
            <div>
              Deletion scheduled for{" "}
              <strong className="tabular-nums">
                {new Date(status.purge_after).toLocaleDateString()}
              </strong>{" "}
              <span className="text-muted-foreground">
                (in {formatDistanceToNowStrict(new Date(status.purge_after))})
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={busy}>
              <Undo2 className="mr-1.5 h-3 w-3" />
              Cancel deletion
            </Button>
          </div>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="mt-3" size="sm" variant="destructive" disabled={busy}>
                Schedule deletion
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Schedule account deletion?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your account and all associated data will be purged 30 days from now. You can
                  cancel anytime in that window.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep account</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  Schedule deletion
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
