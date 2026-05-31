import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// High-impact fields that meaningfully reduce ATS fallbacks if filled.
const FIELDS = [
  "first_name", "last_name", "email", "phone",
  "street_address", "city", "state_region", "postal_code", "country",
  "linkedin_url", "github_url", "portfolio_url",
  "work_authorization", "visa_status", "requires_sponsorship",
  "desired_salary", "salary_currency", "notice_period_weeks", "earliest_start_date",
  "remote_preference", "willing_to_relocate", "years_experience",
  "summary", "headline",
  "gender", "ethnicity", "veteran_status", "disability_status",
] as const;

type ProfileLike = Record<string, unknown> | null | undefined;

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return true; // explicit answer counts
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

export function CompletenessBar({ profile }: { profile: ProfileLike }) {
  if (!profile) return null;
  const filled = FIELDS.filter((k) => isFilled((profile as Record<string, unknown>)[k]));
  const missing = FIELDS.filter((k) => !isFilled((profile as Record<string, unknown>)[k]));
  const pct = Math.round((filled.length / FIELDS.length) * 100);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-sm">Profile completeness</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            More fields filled = fewer AI fallbacks during auto-apply.
          </p>
        </div>
        <span className={cn(
          "text-2xl font-bold tabular-nums",
          pct >= 80 ? "text-success" : pct >= 50 ? "text-foreground" : "text-amber-500",
        )}>{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      {missing.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Missing:</span>{" "}
          {missing.slice(0, 8).map((m) => m.replace(/_/g, " ")).join(", ")}
          {missing.length > 8 && ` +${missing.length - 8} more`}
        </div>
      )}
    </div>
  );
}
