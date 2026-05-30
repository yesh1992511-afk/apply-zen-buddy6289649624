import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Overlay a shimmer + reduced opacity on children while `busy` is true. */
export function BusyOverlay({
  busy,
  label,
  children,
  className,
}: {
  busy: boolean;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)} aria-busy={busy || undefined}>
      <div className={cn("transition-opacity duration-200", busy && "opacity-50 pointer-events-none select-none")}>
        {children}
      </div>
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-background/30 backdrop-blur-[1px]">
          <div className="shimmer absolute inset-0 rounded-[inherit] opacity-40" />
          {label && (
            <span className="relative z-10 rounded-full border border-border/60 bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Slim shimmer row used as a skeleton placeholder for incoming list items. */
export function SourceRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-surface-1 p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Skeleton className="h-6 w-6 rounded-md" />
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-card", className)}>
      <div className="grid gap-3 border-b border-border/40 bg-surface-1 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y divide-border/30">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridCardSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
