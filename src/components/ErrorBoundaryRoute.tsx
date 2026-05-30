import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorBoundaryRoute({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-card p-8 text-center surface-frost float-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <h2 className="font-heading text-xl font-semibold">Something broke loading this page</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <Button
        onClick={() => {
          reset();
          router.invalidate();
        }}
        className="gap-2 bg-gradient-emerald shadow-glow"
      >
        <RotateCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
