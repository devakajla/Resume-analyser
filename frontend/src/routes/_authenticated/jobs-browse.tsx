import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { api, getRoleRedirect } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type Job = {
  id: string;
  title: string;
  company: string;
  department?: string;
  salary_min?: number;
  salary_max?: number;
  experience_required?: string;
  skills?: string[];
  rounds?: number;
};

export const Route = createFileRoute("/_authenticated/jobs-browse")({
  beforeLoad: () => {
    const to = getRoleRedirect("candidate");
    if (to) throw redirect({ to });
  },
  component: BrowseJobsPage,
});

function BrowseJobsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", "live"],
    queryFn: () => api<Job[]>("/jobs", { auth: false }),
  });

  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const apply = useMutation({
    mutationFn: async ({ jobId, file }: { jobId: string; file: File }) => {
      const fd = new FormData();
      fd.append("resume", file);
      return api(`/jobs/${jobId}/apply`, { method: "POST", formData: fd });
    },
    onSuccess: () => {
      toast.success("Application submitted");
      setApplyJob(null);
      setFile(null);
      navigate({ to: "/my-applications" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to apply"),
  });

  const jobs = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Browse Jobs</h1>
        <p className="mt-2 text-sm text-muted-foreground">Find live openings and submit your resume for analysis.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-danger">Failed to load jobs.</div>
      ) : jobs.length === 0 ? (
        <div className="app-panel rounded-lg p-8 text-center text-muted-foreground">No live jobs right now.</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="app-panel app-panel-hover rounded-lg p-5 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg text-foreground font-semibold">{j.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {j.company}{j.department ? ` · ${j.department}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {j.salary_min != null && j.salary_max != null && (
                      <span>💰 {j.salary_min.toLocaleString()} – {j.salary_max.toLocaleString()}</span>
                    )}
                    {j.experience_required && <span>⏳ {j.experience_required}</span>}
                    {j.rounds != null && <span>🎯 {j.rounds} round{j.rounds === 1 ? "" : "s"}</span>}
                  </div>
                  {j.skills && j.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {j.skills.map((s) => (
                    <span key={s} className="rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => { setApplyJob(j); setFile(null); }}>Apply</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!applyJob}
        onOpenChange={(o) => { if (!o && !apply.isPending) { setApplyJob(null); setFile(null); } }}
      >
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to {applyJob?.title}</DialogTitle>
          </DialogHeader>
          {apply.isPending ? (
            <div className="py-10 flex flex-col items-center text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="mt-4 text-sm text-foreground">Analyzing resume…</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Parsing your CV and computing compatibility scores. This may take 5–15 seconds.
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <label className="block">
                  <div className="text-xs text-muted-foreground mb-1.5">
                    Resume (PDF, DOCX, TXT, PNG, JPG)
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-secondary">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-2 file:py-1 file:text-xs"
                    />
                  </div>
                  {file && (
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {file.name} · {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </label>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setApplyJob(null); setFile(null); }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!applyJob || !file) { toast.error("Choose a file"); return; }
                    apply.mutate({ jobId: applyJob.id, file });
                  }}
                >
                  Submit application
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}