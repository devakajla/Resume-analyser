import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getRoleRedirect } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Company = {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  jd_template?: string;
  job_count?: number;
  department_count?: number;
  created_at?: string;
};

export const Route = createFileRoute("/_authenticated/companies/")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: CompaniesPage,
});

const emptyForm: Omit<Company, "id" | "job_count" | "created_at"> = {
  name: "",
  industry: "",
  website: "",
  jd_template: "",
};

function CompaniesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["companies"],
    queryFn: () => api<Company[]>("/companies"),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(c: Company) {
    setEditing(c);
    setForm({
      name: c.name || "",
      industry: c.industry || "",
      website: c.website || "",
      jd_template: c.jd_template || "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api(`/companies/${editing.id}`, { method: "PATCH", body: form });
      }
      return api(`/companies`, { method: "POST", body: form });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      toast.success(editing ? "Company updated" : "Company created");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setDeleteId(null);
      toast.success("Company deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const companies = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Companies</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage client context, POCs, and JD templates.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Add company
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-danger">Failed to load companies.</div>
      ) : companies.length === 0 ? (
        <div className="app-panel rounded-lg p-8 text-center text-muted-foreground">
          No companies yet. Add your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <div key={c.id} className="app-panel app-panel-hover rounded-lg p-5 transition-colors">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <Link
                    to="/companies/$id"
                    params={{ id: c.id }}
                    className="text-base font-semibold text-foreground hover:text-primary truncate block"
                  >
                    {c.name}
                  </Link>
                  {c.industry && (
                    <div className="text-xs text-muted-foreground mt-0.5">{c.industry}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <div className="text-muted-foreground">
                  Departments: <span className="text-foreground">{c.department_count ?? 0}</span>
                </div>
                <div className="text-muted-foreground">
                  Jobs: <span className="text-foreground">{c.job_count ?? 0}</span>
                </div>
                <Link
                  to="/companies/$id"
                  params={{ id: c.id }}
                  className="inline-block mt-2 text-xs text-primary hover:underline"
                >
                  Manage departments →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit company" : "Add company"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry (optional)">
                <Input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </Field>
              <Field label="Website (optional)">
                <Input value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </Field>
            </div>
            <Field label="JD template (optional)">
              <Textarea rows={3} value={form.jd_template || ""} onChange={(e) => setForm({ ...form, jd_template: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.name.trim()) {
                  toast.error("Name is required");
                  return;
                }
                save.mutate();
              }}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Jobs linked to this company may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={() => deleteId && del.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-danger"> *</span>}</Label>
      {children}
    </div>
  );
}