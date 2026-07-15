import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api, setAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"hr" | "candidate">("candidate");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string; user: any }>("/signup", {
        method: "POST",
        auth: false,
        body: { name, email, password, role },
      });
      setAuth(res.token, res.user);
      toast.success("Account created");
      navigate({ to: res.user?.role === "hr" ? "/dashboard" : "/jobs-browse" });
    } catch (err: any) {
      toast.error(err.message || "Sign up failed");
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
              <h1 className="font-display text-4xl font-semibold text-foreground">Start clean</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                Create a recruiter console or candidate tracker with role-aware access from the first session.
              </p>
            </div>
            <div className="text-xs text-muted-foreground">AI Resume Analyser</div>
          </section>
          <section className="p-8 md:p-10">
            <h2 className="font-display text-2xl font-semibold text-foreground">Sign up</h2>
            <p className="mt-2 text-sm text-muted-foreground">Choose your role and create your account.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>I am a</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "hr" | "candidate")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="candidate">Candidate</SelectItem>
                <SelectItem value="hr">Recruiter (HR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
          </section>
        </div>
      </div>
    </div>
  );
}