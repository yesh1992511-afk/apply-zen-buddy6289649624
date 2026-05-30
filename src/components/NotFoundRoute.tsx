import { Link } from "@tanstack/react-router";
import { Compass, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundRoute({
  title = "We couldn't find that",
  message = "The page or record you're looking for doesn't exist or was moved.",
  backTo = "/dashboard",
  backLabel = "Back to dashboard",
}: {
  title?: string;
  message?: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center surface-frost float-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Compass className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button asChild variant="outline" className="gap-2">
        <Link to={backTo}>
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
      </Button>
    </div>
  );
}
