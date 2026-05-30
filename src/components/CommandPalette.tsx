/**
 * ⌘K command palette — Mac-native feel. Mounted globally inside the
 * authenticated layout so it is available on every page.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Briefcase,
  Database,
  Filter as FilterIcon,
  Send,
  User,
  Bell,
  Cog,
  ScrollText,
  Sparkles,
  Play,
  Pause,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { toast } from "sonner";

const NAV: Array<{ label: string; to: string; icon: React.ComponentType<{ className?: string }>; keywords?: string }> = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { label: "Jobs", to: "/jobs", icon: Briefcase, keywords: "matches discoveries" },
  { label: "Applications", to: "/applications", icon: Send, keywords: "applied queue" },
  { label: "Sources", to: "/sources", icon: Database, keywords: "scrapers feeds boards" },
  { label: "Filters", to: "/filters", icon: FilterIcon, keywords: "criteria search" },
  { label: "Profile", to: "/profile", icon: User, keywords: "resume cv personal" },
  { label: "Automation", to: "/automation", icon: Cog, keywords: "autopilot settings" },
  { label: "Notifications", to: "/notifications", icon: Bell, keywords: "email alerts gmail" },
  { label: "Logs", to: "/logs", icon: ScrollText, keywords: "activity history" },
  { label: "Setup", to: "/setup", icon: Sparkles, keywords: "worker install" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const go = (to: string) => {
    close();
    navigate({ to });
  };

  const runSources = async () => {
    close();
    if (!user) return;
    toast.loading("Fetching jobs from all sources…", { id: "run-sources" });
    try {
      const res = await fetch(`/api/public/sources/run-tier?tier=hot&user_id=${user.id}`);
      const json = await res.json() as { ok?: boolean; summary?: Record<string, { fetched: number; inserted: number }> };
      const totals = Object.values(json.summary ?? {}).reduce(
        (a, b) => ({ fetched: a.fetched + b.fetched, inserted: a.inserted + b.inserted }),
        { fetched: 0, inserted: 0 },
      );
      toast.success(`Fetched ${totals.fetched} · ${totals.inserted} new`, { id: "run-sources" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { id: "run-sources" });
    }
  };

  const toggleAutopilot = async (enabled: boolean) => {
    close();
    if (!user) return;
    const { error } = await supabase
      .from("automation_settings")
      .upsert({ user_id: user.id, enabled } as never, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else toast.success(enabled ? "Autopilot resumed" : "Autopilot paused");
  };

  const runApplyWorker = async () => {
    close();
    toast.loading("Running apply worker…", { id: "apply-worker" });
    try {
      const res = await fetch("/api/public/hooks/apply-worker");
      const json = await res.json() as { ok?: boolean; processed?: number };
      toast.success(`Worker processed ${json.processed ?? 0} application(s)`, { id: "apply-worker" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { id: "apply-worker" });
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or run a command…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem key={n.to} value={`${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n.to)}>
              <n.icon className="mr-2 h-4 w-4" /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="run sources fetch jobs now" onSelect={runSources}>
            <Zap className="mr-2 h-4 w-4 text-warning" /> Fetch jobs from all sources
            <CommandShortcut>now</CommandShortcut>
          </CommandItem>
          <CommandItem value="run apply worker process queue" onSelect={runApplyWorker}>
            <Play className="mr-2 h-4 w-4 text-success" /> Run apply worker
          </CommandItem>
          <CommandItem value="autopilot on enable resume" onSelect={() => toggleAutopilot(true)}>
            <Play className="mr-2 h-4 w-4" /> Resume autopilot
          </CommandItem>
          <CommandItem value="autopilot off pause" onSelect={() => toggleAutopilot(false)}>
            <Pause className="mr-2 h-4 w-4" /> Pause autopilot
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
