import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, getRoleRedirect } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type Application = {
  application_id: string;
  job_id: string;
  job_title: string;
  current_stage: string;
  applied_at: string;
};

export const Route = createFileRoute("/_authenticated/my-applications/")({
  beforeLoad: () => {
    const to = getRoleRedirect("candidate");
    if (to) throw redirect({ to });
  },
  component: MyApplicationsPage,
});

function MyApplicationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => api<Application[]>("/my-applications"),
  });
  const apps = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">My Applications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track each role from applied through interviews.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-sm text-danger">Failed to load applications.</div>
      ) : apps.length === 0 ? (
        <div className="app-panel rounded-lg p-8 text-center text-muted-foreground">
          You haven't applied to any jobs yet.
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Link
              key={a.application_id}
              to="/my-applications/$id"
              params={{ id: a.application_id }}
              className="app-panel app-panel-hover block rounded-lg p-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-foreground font-medium truncate">{a.job_title}</div>
                  <div className="text-xs text-muted-foreground">
                    Applied {new Date(a.applied_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/15 text-primary">
                  {a.current_stage}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}