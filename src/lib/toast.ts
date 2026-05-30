import { toast } from "sonner";

/**
 * Unified toast helpers — consistent copy and tone across the app.
 * Use these instead of calling `toast.success`/`toast.error` directly.
 */

export function toastSaved(label = "Saved") {
  toast.success(label);
}

export function toastError(err: unknown, fallback = "Something went wrong") {
  // Try to parse our AppError envelope for {code, message, hint}.
  let message = fallback;
  let hint: string | undefined;
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        message = String(parsed.message) || fallback;
        if (typeof parsed.hint === "string") hint = parsed.hint;
      } else {
        message = raw;
      }
    } catch {
      message = raw;
    }
  }
  toast.error(message || fallback, hint ? { description: hint } : undefined);
}

export function toastQueued(n: number, what = "job") {
  toast.success(`Queued ${n} ${what}${n === 1 ? "" : "s"} for the worker.`);
}

export function toastInfo(message: string, description?: string) {
  toast.message(message, description ? { description } : undefined);
}

export { toast };
