import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { api, getRoleRedirect } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
};

type Department = {
  id: string;
  name: string;
  poc_name?: string;
  poc_email?: string;
  poc_phone?: string;
  job_count?: number;
};

export const Route = createFileRoute("/_authenticated/companies/$id")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: CompanyDetailPage,
});

const emptyDept = { name: "", poc_name: "", poc_email: "", poc_phone: "" };

function CompanyDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: company, isLoading: loadingCompany } = useQuery({
    queryKey: ["company", id],
    queryFn: () => api<Company>(`/companies/${id}`),
  });
  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ["company", id, "departments"],
    queryFn: () => api<Department[]>(`/companies/${id}/departments`),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ ...emptyDept });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyDept });
    setOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setForm({
      name: d.name || "",
      poc_name: d.poc_name || "",
      poc_email: d.poc_email || "",
      poc_phone: d.poc_phone || "",
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api(`/departments/${editing.id}`, { method: "PATCH", body: form });
      }
      return api(`/companies/${id}/departments`, { method: "POST", body: form });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", id, "departments"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      toast.success(editing ? "Department updated" : "Department created");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const del = useMutation({
    mutationFn: (deptId: string) => api(`/departments/${deptId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", id, "departments"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setDeleteId(null);
      toast.success("Department deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const depts = departments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/companies"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          {loadingCompany ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold text-foreground truncate">
                {company?.name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {company?.industry || "—"}
                {company?.website ? ` · ${company.website}` : ""}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="app-panel rounded-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Departments</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each department has its own point of contact and job listings.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add department
          </Button>
        </div>

        {loadingDepts ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : depts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No departments yet. Add the first one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium">POC name</th>
                <th className="px-6 py-3 font-medium">POC email</th>
                <th className="px-6 py-3 font-medium">Jobs</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-secondary transition-colors">
                  <td className="px-6 py-3 text-foreground">{d.name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{d.poc_name || "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{d.poc_email || "—"}</td>
                  <td className="px-6 py-3 text-foreground">{d.job_count ?? 0}</td>
                  <td className="px-6 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(d.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit department" : "Add department"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="POC name (optional)">
                <Input value={form.poc_name} onChange={(e) => setForm({ ...form, poc_name: e.target.value })} />
              </Field>
              <Field label="POC email (optional)">
                <Input value={form.poc_email} onChange={(e) => setForm({ ...form, poc_email: e.target.value })} />
              </Field>
            </div>
            <Field label="POC phone (optional)">
              <Input value={form.poc_phone} onChange={(e) => setForm({ ...form, poc_phone: e.target.value })} />
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
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>
              Jobs linked to this department may be affected. This cannot be undone.
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