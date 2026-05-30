import { toast } from "sonner";

/**
 * Unified toast helpers — consistent copy and tone across the app.
 * Use these instead of calling `toast.success`/`toast.error` directly.
 */

export function toastSaved(label = "Saved") {
  toast.success(label);
}

export function toastError(err: unknown, fallback = "Something went wrong") {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : fallback;
  toast.error(msg || fallback);
}

export function toastQueued(n: number, what = "job") {
  toast.success(`Queued ${n} ${what}${n === 1 ? "" : "s"} for the worker.`);
}

export function toastInfo(message: string, description?: string) {
  toast.message(message, description ? { description } : undefined);
}

export { toast };
