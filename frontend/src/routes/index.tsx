import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("auth_token");
    if (!token) throw redirect({ to: "/login" });
    let role: string | undefined;
    try {
      role = JSON.parse(window.localStorage.getItem("auth_user") || "{}")?.role;
    } catch {}
    throw redirect({ to: role === "hr" ? "/dashboard" : "/jobs-browse" });
  },
  component: () => null,
});