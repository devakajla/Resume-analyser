import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, getRoleRedirect } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

type Job = {
  id: string;
  title: string;
  company: string;
  company_id: string;
  status: string;
  rounds: number;
  applicant_count: number;
  salary_min?: number;
  salary_max?: number;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", "mine"],
    queryFn: () => api<Job[]>("/jobs/mine"),
  });

  const jobs = data ?? [];
  const activeJobs = jobs.filter((j) => j.status === "live").length;
  const totalApplicants = jobs.reduce((sum, j) => sum + (j.applicant_count || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Live recruiting signal across your open roles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard label="Active jobs" value={isLoading ? null : activeJobs} />
        <MetricCard label="Total applicants" value={isLoading ? null : totalApplicants} />
      </div>

      <div className="app-panel overflow-hidden rounded-lg">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">All jobs</h2>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-danger">Failed to load jobs.</div>
        ) : jobs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No jobs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Company</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Applicants</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const hasSalaryError = j.salary_min != null && j.salary_max != null && j.salary_max < j.salary_min;
                return (
                  <tr
                    key={j.id}
                    className={`border-t border-border transition-colors ${
                      hasSalaryError
                        ? "bg-danger/[0.04] border-danger/20 hover:bg-danger/[0.08]"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <td className="px-6 py-3 text-foreground font-medium">
                      <div className="flex items-center gap-2">
                        {j.title}
                        {hasSalaryError && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-danger/15 text-danger border border-danger/20">
                            Invalid Salary Range
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{j.company}</td>
                    <td className="px-6 py-3"><StatusBadge status={j.status} /></td>
                    <td className="px-6 py-3 text-foreground">{j.applicant_count}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        to="/jobs/$id/applicants"
                        params={{ id: j.id }}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="app-panel rounded-lg p-6">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-4xl font-semibold text-foreground">
        {value === null ? <Skeleton className="h-10 w-16" /> : value}
      </div>
    </div>
  );
}