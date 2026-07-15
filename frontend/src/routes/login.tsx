import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, setAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: any }>("/login", {
        method: "POST",
        auth: false,
        form: { username: email, password },
      });
      setAuth(res.token, res.user);
      toast.success("Welcome back");
      navigate({ to: res.user?.role === "hr" ? "/dashboard" : "/jobs-browse" });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-background/60 md:grid-cols-[1fr_420px]">
          <section className="hidden bg-sidebar p-10 md:flex md:flex-col md:justify-between">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold">RA</div>
            <div>
              <h1 className="font-display text-4xl font-semibold text-foreground">Resume OS</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                ATS scoring, recruiter summaries, career insights, and interview stages in one focused workspace.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">AI Resume Analyser</div>
          </section>
          <section className="p-8 md:p-10">
            <h2 className="font-display text-2xl font-semibold text-foreground">Log in</h2>
            <p className="mt-2 text-sm text-muted-foreground">Access your hiring or candidate workspace.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Log in"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground text-center">
          No account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
          </section>
        </div>
      </div>
    </div>
  );
}