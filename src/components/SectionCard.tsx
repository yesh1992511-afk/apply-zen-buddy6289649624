import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SavedIndicator, type SaveState } from "@/components/SavedIndicator";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  saveState,
  error,
  children,
  className,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  saveState?: SaveState;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Card className={cn("lift", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <CardDescription className="mt-1">{description}</CardDescription>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {saveState && <SavedIndicator state={saveState} error={error} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
