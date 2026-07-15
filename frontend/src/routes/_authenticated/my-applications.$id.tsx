import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, XCircle } from "lucide-react";
import { api, getRoleRedirect } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type Step = { stage: string; status: "completed" | "current" | "upcoming" };
type Progress = {
  application_id: string;
  job_title: string;
  current_stage: string;
  is_rejected: boolean;
  steps: Step[];
};

export const Route = createFileRoute("/_authenticated/my-applications/$id")({
  beforeLoad: () => {
    const to = getRoleRedirect("candidate");
    if (to) throw redirect({ to });
  },
  component: ProgressPage,
});

function ProgressPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-applications", id, "progress"],
    queryFn: () => api<Progress>(`/my-applications/${id}/progress`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/my-applications" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            {data?.job_title || "Application"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your progress timeline.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : error || !data ? (
        <div className="text-sm text-danger">Failed to load progress.</div>
      ) : (
        <div className="app-panel rounded-lg p-6">
          {data.is_rejected && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
              <XCircle className="h-4 w-4" />
              Unfortunately, your application was not selected to move forward.
            </div>
          )}
          <ol className="relative border-l border-border ml-3 space-y-6">
            {data.steps.map((step) => {
              const rejected = data.is_rejected && step.status === "current";
              return (
                <li key={step.stage} className="ml-6">
                  <span
                    className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${
                      rejected
                        ? "bg-danger/20 text-danger"
                        : step.status === "completed"
                        ? "bg-success/20 text-success"
                        : step.status === "current"
                        ? "bg-primary/20 text-primary ring-2 ring-primary/40"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {step.status === "completed" ? (
                      <Check className="h-3 w-3" />
                    ) : rejected ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                  </span>
                  <div className="flex items-center justify-between">
                    <div
                      className={`text-sm ${
                        step.status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {step.stage}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {rejected ? "rejected" : step.status}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}