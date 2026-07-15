import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, getRoleRedirect } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type Job = { id: string; title: string; company: string };

export const Route = createFileRoute("/_authenticated/pipeline")({
  beforeLoad: () => {
    const to = getRoleRedirect("hr");
    if (to) throw redirect({ to });
  },
  component: PipelineIndex,
});

function PipelineIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs", "mine"],
    queryFn: () => api<Job[]>("/jobs/mine"),
  });
  const jobs = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Pipeline</h1>
        <p className="mt-2 text-sm text-muted-foreground">Open a focused stage board for each job.</p>
      </div>
      <div className="app-panel overflow-hidden rounded-lg">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No jobs yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  to="/jobs/$id/pipeline"
                  params={{ id: j.id }}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary"
                >
                  <div>
                    <div className="text-foreground">{j.title}</div>
                    <div className="text-xs text-muted-foreground">{j.company}</div>
                  </div>
                  <div className="text-sm text-primary">Open board →</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}