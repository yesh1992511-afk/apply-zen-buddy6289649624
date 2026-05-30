import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Plane,
  LayoutDashboard,
  Briefcase,
  Send,
  User,
  Filter,
  Database,
  Settings,
  ScrollText,
  Server,
  LogOut,
  Bell,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const pilot = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Sources", to: "/sources", icon: Database },
  { title: "Filters", to: "/filters", icon: Filter },
  { title: "Jobs", to: "/jobs", icon: Briefcase },
  { title: "Applications", to: "/applications", icon: Send },
];

const profile = [
  { title: "Profile", to: "/profile", icon: User },
  { title: "Automation", to: "/automation", icon: FileText },
];

const system = [
  { title: "Notifications", to: "/notifications", icon: Bell },
  { title: "Logs", to: "/logs", icon: ScrollText },
  { title: "Worker", to: "/setup", icon: Server },
];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const renderGroup = (label: string, items: typeof pilot) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            return (
              <SidebarMenuItem key={it.to}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="h-9 data-[active=true]:bg-primary/15 data-[active=true]:text-foreground data-[active=true]:font-medium relative data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-[2px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary"
                >
                  <Link to={it.to}>
                    <it.icon className="h-4 w-4" />
                    <span className="font-sans">{it.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-2">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-emerald shadow-glow">
            <Plane className="h-4 w-4 text-primary-foreground -rotate-45" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-sm font-semibold tracking-tight">JobPilot</span>
            <span className="text-[10px] text-muted-foreground">Autopilot cockpit</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1">
        {renderGroup("Pilot", pilot)}
        {renderGroup("Profile", profile)}
        {renderGroup("System", system)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60">
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
