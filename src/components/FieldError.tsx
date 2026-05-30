import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div className={cn("mt-1 flex items-start gap-1.5 text-xs text-destructive", className)}>
      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
