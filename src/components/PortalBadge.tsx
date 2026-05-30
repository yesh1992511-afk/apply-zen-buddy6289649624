import { cn } from "@/lib/utils";
import { Database, Briefcase, Linkedin, Building2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PORTAL_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  greenhouse: { label: "Greenhouse", icon: Building2, color: "text-success" },
  lever: { label: "Lever", icon: Building2, color: "text-primary" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-[oklch(0.60_0.18_240)]" },
  workday: { label: "Workday", icon: Building2, color: "text-gold" },
  indeed: { label: "Indeed", icon: Briefcase, color: "text-[oklch(0.60_0.18_240)]" },
  apify_linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-[oklch(0.60_0.18_240)]" },
  apify_indeed: { label: "Indeed", icon: Briefcase, color: "text-[oklch(0.60_0.18_240)]" },
  apify_ziprecruiter: { label: "ZipRecruiter", icon: Briefcase, color: "text-gold" },
  apify_dice: { label: "Dice", icon: Briefcase, color: "text-destructive" },
  remoteok: { label: "RemoteOK", icon: Database, color: "text-foreground" },
  remotive: { label: "Remotive", icon: Database, color: "text-primary" },
  adzuna: { label: "Adzuna", icon: Database, color: "text-warning" },
  jooble: { label: "Jooble", icon: Database, color: "text-primary" },
  usajobs: { label: "USAJobs", icon: Building2, color: "text-success" },
  greenhouse_boards: { label: "Greenhouse", icon: Building2, color: "text-success" },
  lever_boards: { label: "Lever", icon: Building2, color: "text-primary" },
  ashby_boards: { label: "Ashby", icon: Building2, color: "text-foreground" },
};

export function PortalBadge({
  source,
  className,
  size = "md",
}: {
  source: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const meta = PORTAL_META[source] ?? { label: source, icon: Database, color: "text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-2 font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5", meta.color)} />
      <span className="capitalize">{meta.label}</span>
    </span>
  );
}
