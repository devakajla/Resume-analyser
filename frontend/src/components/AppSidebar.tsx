import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Building2, Briefcase, Users, GitBranch, LogOut, Search, FileText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { clearAuth, getUser } from "@/lib/api";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const HR_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/applicants", label: "Applicants", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: GitBranch },
] as const;

const CANDIDATE_NAV = [
  { to: "/jobs-browse", label: "Browse Jobs", icon: Search },
  { to: "/my-applications", label: "My Applications", icon: FileText },
] as const;

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function handleLogout() {
    clearAuth();
    navigate({ to: "/login" });
  }

  const nav = user?.role === "hr" ? HR_NAV : CANDIDATE_NAV;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300",
        collapsed ? "w-[84px]" : "w-[260px]",
      )}
    >
      <div className="px-4 py-5">
        <div className={cn("flex", collapsed ? "flex-col items-center gap-2" : "items-center gap-3")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-display text-sm font-bold">
            RA
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-sidebar-foreground">Resume OS</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {user?.role === "hr" ? "Hiring workspace" : "Candidate tracker"}
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              !collapsed && "ml-auto",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.to ||
            (item.to !== "/dashboard" && pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all ${
                active
                  ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_3px_0_0_var(--color-primary)]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        {user && !collapsed && (
          <div className="mb-2 rounded-md bg-sidebar-accent/60 px-3 py-2">
            <div className="text-sm text-foreground truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Log out" : undefined}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Log out"}
        </button>
      </div>
    </aside>
  );
}