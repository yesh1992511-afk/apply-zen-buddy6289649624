import { Check, CloudOff, Loader2 } from "lucide-react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function SavedIndicator({
  state,
  error,
}: {
  state: SaveState;
  error?: string | null;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  if (state === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        Unsaved changes
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive" title={error ?? ""}>
        <CloudOff className="h-3.5 w-3.5" />
        Couldn't save
      </span>
    );
  }
  return null;
}
