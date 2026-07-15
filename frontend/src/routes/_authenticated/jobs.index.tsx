import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, getRoleRedirect } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Job = {
  id: string;
  title: string;
  company: string;
  company_id: string;
  department?: string;
  department_id?: string;
  status: string;
  rounds: number;
  applicant_count: number;
  custom_stages?: string[];
  description?: string;
  salary_min?: number;
  salary_max?: number;
  experience_required?: string;
};

type Company = { id: string; name: string };
type Department = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/jobs/")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: JobsPage,
});

function JobsPage() {
  const qc = useQueryClient();
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs", "mine"],
    queryFn: () => api<Job[]>("/jobs/mine"),
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api<Company[]>("/companies"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    company_id: "",
    department_id: "",
    salary_min: "",
    salary_max: "",
    experience_required: "",
    rounds: "3",
    custom_stages_str: "",
  });

  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    salary_min: "",
    salary_max: "",
    experience_required: "",
    rounds: "3",
    custom_stages_str: "",
  });

  const { data: departments, isFetching: loadingDepts } = useQuery({
    queryKey: ["company", form.company_id, "departments"],
    queryFn: () => api<Department[]>(`/companies/${form.company_id}/departments`),
    enabled: !!form.company_id,
  });

  const handleStartEdit = async (j: Job) => {
    try {
      const fullJob = await api<Job>(`/jobs/${j.id}`);
      setEditingJob(fullJob);
      setEditForm({
        title: fullJob.title || "",
        description: fullJob.description || "",
        salary_min: fullJob.salary_min != null ? String(fullJob.salary_min) : "",
        salary_max: fullJob.salary_max != null ? String(fullJob.salary_max) : "",
        experience_required: fullJob.experience_required || "",
        rounds: fullJob.rounds != null ? String(fullJob.rounds) : "3",
        custom_stages_str: fullJob.custom_stages ? fullJob.custom_stages.join(", ") : "",
      });
    } catch (err: any) {
      toast.error("Failed to load job details");
    }
  };

  const create = useMutation({
    mutationFn: () => {
      const customStages = form.custom_stages_str
        ? form.custom_stages_str.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      return api("/jobs", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          department_id: form.department_id,
          salary_min: Number(form.salary_min) || 0,
          salary_max: Number(form.salary_max) || 0,
          experience_required: form.experience_required,
          rounds: Number(form.rounds) || 1,
          custom_stages: customStages,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", "mine"] });
      setOpen(false);
      setForm({ title: "", description: "", company_id: "", department_id: "", salary_min: "", salary_max: "", experience_required: "", rounds: "3", custom_stages_str: "" });
      toast.success("Job created");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const updateJobMutation = useMutation({
    mutationFn: () => {
      if (!editingJob) throw new Error("No job selected for editing");
      const customStages = editForm.custom_stages_str
        ? editForm.custom_stages_str.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      return api(`/jobs/${editingJob.id}`, {
        method: "PATCH",
        body: {
          title: editForm.title,
          description: editForm.description,
          salary_min: Number(editForm.salary_min) || 0,
          salary_max: Number(editForm.salary_max) || 0,
          experience_required: editForm.experience_required,
          rounds: Number(editForm.rounds) || 1,
          custom_stages: customStages,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", "mine"] });
      setEditingJob(null);
      toast.success("Job updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update job"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/jobs/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", "mine"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const list = jobs ?? [];
  const drafts = list.filter((j) => j.status === "draft");
  const live = list.filter((j) => j.status === "live");
  const closed = list.filter((j) => j.status === "closed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Jobs</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create roles, publish openings, and jump into applicant flows.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create job
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="app-panel rounded-lg p-8 text-center text-muted-foreground">No jobs yet.</div>
      ) : (
        <>
          <JobGroup title="Live" jobs={live} onStatus={(id, status) => updateStatus.mutate({ id, status })} onEdit={handleStartEdit} />
          <JobGroup title="Draft" jobs={drafts} onStatus={(id, status) => updateStatus.mutate({ id, status })} onEdit={handleStartEdit} />
          {closed.length > 0 && (
            <JobGroup title="Closed" jobs={closed} onStatus={(id, status) => updateStatus.mutate({ id, status })} onEdit={handleStartEdit} />
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Create job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={form.company_id}
                onValueChange={(v) => setForm({ ...form, company_id: v, department_id: "" })}
              >
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={form.department_id}
                onValueChange={(v) => setForm({ ...form, department_id: v })}
                disabled={!form.company_id || loadingDepts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !form.company_id
                      ? "Pick a company first"
                      : loadingDepts
                        ? "Loading departments..."
                        : (departments && departments.length === 0)
                          ? "No departments — add one first"
                          : "Select department"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (JD)</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Experience required</Label>
              <Input placeholder="e.g. 2-4 years" value={form.experience_required} onChange={(e) => setForm({ ...form, experience_required: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Salary min</Label>
                <Input type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Salary max</Label>
                <Input type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Rounds</Label>
                <Input type="number" min={1} max={10} value={form.rounds} onChange={(e) => setForm({ ...form, rounds: e.target.value })} />
              </div>
            </div>
            {form.salary_min && form.salary_max && Number(form.salary_max) < Number(form.salary_min) && (
              <p className="text-xs text-danger font-medium mt-1">Maximum salary cannot be less than minimum salary</p>
            )}
            <div className="space-y-1.5">
              <Label>Custom Stages (comma-separated, optional)</Label>
              <Input placeholder="e.g. Technical Round, System Design, HR Fit" value={form.custom_stages_str} onChange={(e) => setForm({ ...form, custom_stages_str: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.title || !form.company_id || !form.department_id || !form.description) {
                  toast.error("Title, company, department, and description are required");
                  return;
                }
                create.mutate();
              }}
              disabled={create.isPending || (form.salary_min && form.salary_max && Number(form.salary_max) < Number(form.salary_min))}
            >
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingJob} onOpenChange={(o) => !o && setEditingJob(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (JD)</Label>
              <Textarea rows={5} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Experience required</Label>
              <Input placeholder="e.g. 2-4 years" value={editForm.experience_required} onChange={(e) => setEditForm({ ...editForm, experience_required: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Salary min</Label>
                <Input type="number" value={editForm.salary_min} onChange={(e) => setEditForm({ ...editForm, salary_min: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Salary max</Label>
                <Input type="number" value={editForm.salary_max} onChange={(e) => setEditForm({ ...editForm, salary_max: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Rounds</Label>
                <Input type="number" min={1} max={10} value={editForm.rounds} onChange={(e) => setEditForm({ ...editForm, rounds: e.target.value })} />
              </div>
            </div>
            {editForm.salary_min && editForm.salary_max && Number(editForm.salary_max) < Number(editForm.salary_min) && (
              <p className="text-xs text-danger font-medium mt-1">Maximum salary cannot be less than minimum salary</p>
            )}
            <div className="space-y-1.5">
              <Label>Custom Stages (comma-separated, optional)</Label>
              <Input placeholder="e.g. Technical Round, System Design, HR Fit" value={editForm.custom_stages_str} onChange={(e) => setEditForm({ ...editForm, custom_stages_str: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!editForm.title || !editForm.description) {
                  toast.error("Title and description are required");
                  return;
                }
                updateJobMutation.mutate();
              }}
              disabled={updateJobMutation.isPending || (editForm.salary_min && editForm.salary_max && Number(editForm.salary_max) < Number(editForm.salary_min))}
            >
              {updateJobMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobGroup({
  title,
  jobs,
  onStatus,
  onEdit,
}: {
  title: string;
  jobs: Job[];
  onStatus: (id: string, status: string) => void;
  onEdit: (job: Job) => void;
}) {
  const navigate = useNavigate();
  if (jobs.length === 0) return null;
  return (
    <div className="app-panel overflow-hidden rounded-lg">
      <div className="px-6 py-3 border-b border-border flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({jobs.length})</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-medium">Title</th>
            <th className="px-6 py-3 font-medium">Company · Department</th>
            <th className="px-6 py-3 font-medium">Applicants</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const hasSalaryError = j.salary_min != null && j.salary_max != null && j.salary_max < j.salary_min;
            return (
              <tr
                key={j.id}
                onClick={() => {
                  navigate({ to: "/jobs/$id/applicants", params: { id: j.id } });
                }}
                className={`cursor-pointer border-t border-border transition-colors ${
                  hasSalaryError
                    ? "bg-danger/[0.04] border-danger/20 hover:bg-danger/[0.08]"
                    : "hover:bg-secondary"
                }`}
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/jobs/$id/applicants"
                      params={{ id: j.id }}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {j.title}
                    </Link>
                    {hasSalaryError && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-danger/15 text-danger border border-danger/20">
                        Invalid Salary Range
                      </span>
                    )}
                  </div>
                </td>
              <td className="px-6 py-3 text-muted-foreground">
                {j.company}{j.department ? ` · ${j.department}` : ""}
              </td>
              <td className="px-6 py-3 text-foreground">{j.applicant_count}</td>
              <td className="px-6 py-3"><StatusBadge status={j.status} /></td>
              <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  <Select value={j.status} onValueChange={(v) => onStatus(j.id, v)}>
                    <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(j);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
        </tbody>
      </table>
    </div>
  );
}