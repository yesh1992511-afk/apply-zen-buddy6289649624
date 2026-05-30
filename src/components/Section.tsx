import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  actions,
  children,
  className,
  divider = false,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  divider?: boolean;
}) {
  return (
    <section className={cn("space-y-3", divider && "border-t border-border/40 pt-6", className)}>
      {(title || actions) && (
        <header className="flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
