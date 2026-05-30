import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "idle" | "warning";

const colors: Record<Status, string> = {
  online: "bg-success animate-pulse-dot",
  offline: "bg-destructive",
  idle: "bg-muted-foreground",
  warning: "bg-warning",
};

export function StatusDot({
  status,
  className,
  size = "md",
}: {
  status: Status;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeCls = size === "sm" ? "h-2 w-2" : size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";
  return <span className={cn("inline-block rounded-full", sizeCls, colors[status], className)} aria-hidden />;
}
