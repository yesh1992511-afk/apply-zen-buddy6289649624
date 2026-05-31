/**
 * ⌘K command palette — Mac-native feel. Mounted globally inside the
 * authenticated layout so it is available on every page.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
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
  Chrome,
  Clock,
  Keyboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/lib/useAuth";
import { toast } from "sonner";
import { Kbd } from "@/components/Kbd";

const NAV: Array<{ id: string; label: string; to: string; icon: React.ComponentType<{ className?: string }>; keywords?: string; shortcut?: string[] }> = [
  { id: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, keywords: "home overview", shortcut: ["G", "D"] },
  { id: "jobs", label: "Jobs", to: "/jobs", icon: Briefcase, keywords: "matches discoveries", shortcut: ["G", "J"] },
  { id: "applications", label: "Applications", to: "/applications", icon: Send, keywords: "applied queue", shortcut: ["G", "A"] },
  { id: "sources", label: "Sources", to: "/sources", icon: Database, keywords: "scrapers feeds boards", shortcut: ["G", "S"] },
  { id: "extension", label: "Browser Extension", to: "/extension", icon: Chrome, keywords: "linkedin indeed glassdoor capture", shortcut: ["G", "E"] },
  { id: "filters", label: "Filters", to: "/filters", icon: FilterIcon, keywords: "criteria search", shortcut: ["G", "F"] },
  { id: "profile", label: "Profile", to: "/profile", icon: User, keywords: "resume cv personal", shortcut: ["G", "P"] },
  { id: "automation", label: "Automation", to: "/automation", icon: Cog, keywords: "autopilot settings", shortcut: ["G", "O"] },
  { id: "notifications", label: "Notifications", to: "/notifications", icon: Bell, keywords: "email alerts gmail", shortcut: ["G", "N"] },
  { id: "logs", label: "Logs", to: "/logs", icon: ScrollText, keywords: "activity history", shortcut: ["G", "L"] },
  { id: "setup", label: "Worker setup", to: "/setup", icon: Sparkles, keywords: "worker install" },
];

const RECENT_KEY = "jobpilot.palette.recent";
const MAX_RECENT = 4;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

function pushRecent(id: string) {
  const cur = readRecent().filter((x) => x !== id);
  cur.unshift(id);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, MAX_RECENT))); } catch { /* ignore */ }
}

export function CommandPalette({ onShowHelp }: { onShowHelp?: () => void }) {
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (open) setRecentIds(readRecent());
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const go = (item: typeof NAV[number]) => {
    close();
    pushRecent(item.id);
    navigate({ to: item.to });
  };

  const recentItems = useMemo(
    () => recentIds.map((id) => NAV.find((n) => n.id === id)).filter(Boolean) as typeof NAV,
    [recentIds],
  );

  const authHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  };

  const runSources = async () => {
    close();
    if (!user) return;
    toast.loading("Fetching jobs from all sources…", { id: "run-sources" });
    try {
      const res = await fetch(`/api/public/sources/run-tier?tier=hot`, { headers: await authHeaders() });
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
      const res = await fetch("/api/public/hooks/apply-worker", { headers: await authHeaders() });
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

        {recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentItems.map((n) => (
                <CommandItem key={`r-${n.id}`} value={`recent ${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n)}>
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" /> {n.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem key={n.id} value={`${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n)}>
              <n.icon className="mr-2 h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.shortcut && (
                <span className="ml-auto flex items-center gap-1">
                  {n.shortcut.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem value="run sources fetch jobs now" onSelect={runSources}>
            <Zap className="mr-2 h-4 w-4 text-warning" />
            <span className="flex-1">Fetch jobs from all sources</span>
            <span className="ml-auto text-[10px] text-muted-foreground">runs now</span>
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

        {onShowHelp && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Help">
              <CommandItem value="keyboard shortcuts help" onSelect={() => { close(); onShowHelp(); }}>
                <Keyboard className="mr-2 h-4 w-4" />
                <span className="flex-1">Keyboard shortcuts</span>
                <Kbd>?</Kbd>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
