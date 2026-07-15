import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("auth_token");
    if (!token) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <main className={`min-h-screen transition-[margin] duration-300 ${collapsed ? "ml-[84px]" : "ml-[260px]"}`}>
        <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}