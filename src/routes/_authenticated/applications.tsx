import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundaryRoute } from "@/components/ErrorBoundaryRoute";
import { NotFoundRoute } from "@/components/NotFoundRoute";
import { PageHeader } from "@/components/PageHeader";
import { AllApplicationsKanban } from "@/components/AllApplicationsKanban";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — JobPilot" }] }),
  component: ApplicationsPage,
  errorComponent: ErrorBoundaryRoute,
  notFoundComponent: () => <NotFoundRoute />,
});

function ApplicationsPage() {
  return (
    <div className="space-y-6 max-w-[1600px]">
      <PageHeader title="Applications" description="Full pipeline view · live" />
      <AllApplicationsKanban fullHeight />
    </div>
  );
}
