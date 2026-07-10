"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type Step = { stage: string; status: string };
type Progress = {
  application_id: number;
  job_title: string;
  current_stage: string;
  is_rejected: boolean;
  steps: Step[];
};
type AppItem = { application_id: number; job_title: string; current_stage: string };

export default function MyApplicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    if (savedRole !== "candidate") {
      router.push("/login");
      return;
    }
    api
      .get("/my-applications")
      .then(async (res) => {
        const apps: AppItem[] = res.data;
        const details = await Promise.all(
          apps.map((a) =>
            api
              .get(`/my-applications/${a.application_id}/progress`)
              .then((r) => r.data as Progress)
          )
        );
        setItems(details);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/jobs")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Browse roles
        </button>
        <h1 className="text-lg font-semibold text-gray-900">My applications</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : items.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
            You haven&apos;t applied to any roles yet.
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((app) => (
              <div key={app.application_id} className="bg-white border rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-medium text-gray-900">{app.job_title}</h3>
                  {app.is_rejected && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                      Not selected
                    </span>
                  )}
                </div>

                {app.is_rejected ? (
                  <p className="text-sm text-gray-500">
                    This application was not taken forward.
                  </p>
                ) : (
                  <div className="flex items-center">
                    {app.steps.map((step, i) => (
                      <div key={step.stage} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                              step.status === "completed"
                                ? "bg-green-500 text-white"
                                : step.status === "current"
                                ? "bg-blue-600 text-white ring-4 ring-blue-100"
                                : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {step.status === "completed" ? "✓" : i + 1}
                          </div>
                          <span
                            className={`text-xs mt-2 whitespace-nowrap ${
                              step.status === "upcoming" ? "text-gray-400" : "text-gray-700"
                            }`}
                          >
                            {step.stage}
                          </span>
                        </div>
                        {i < app.steps.length - 1 && (
                          <div
                            className={`h-0.5 flex-1 mx-1 ${
                              step.status === "completed" ? "bg-green-500" : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
