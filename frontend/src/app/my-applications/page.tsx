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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-12">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[250px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-900">
        <button
          onClick={() => router.push("/jobs")}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l-7-7m7 7h18" />
          </svg>
          Browse Roles
        </button>
        <h1 className="text-base font-semibold text-zinc-200">My Applications</h1>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 relative z-10 space-y-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-zinc-900/30 border border-zinc-900 rounded-xl p-6 space-y-4">
                <div className="h-5 bg-zinc-800/80 rounded w-1/4" />
                <div className="h-10 bg-zinc-900 rounded w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel border border-zinc-900 rounded-2xl p-12 text-center text-zinc-400 max-w-md mx-auto space-y-3">
            <svg className="w-12 h-12 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 00-2 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-zinc-300 font-medium">No applications yet</p>
            <p className="text-sm text-zinc-500">You haven&apos;t applied to any roles yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {items.map((app) => (
              <div key={app.application_id} className="bg-zinc-900/35 border border-zinc-900/90 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                {/* Subtle side glow for active applications */}
                {!app.is_rejected && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                )}

                <div className="flex items-center justify-between gap-4 mb-8">
                  <h3 className="text-lg font-bold text-zinc-100">{app.job_title}</h3>
                  {app.is_rejected && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-950/40 text-red-400 border border-red-900/40 font-semibold tracking-wide">
                      Not Selected
                    </span>
                  )}
                </div>

                {app.is_rejected ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900/40 rounded-lg px-4 py-3.5 border border-zinc-900">
                    <svg className="w-5 h-5 text-zinc-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>This application was not taken forward. Thank you for your time.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-4 pt-2 -mx-4 px-4 scrollbar-thin">
                    <div className="flex items-center min-w-[600px] justify-between relative">
                      {app.steps.map((step, i) => (
                        <div key={step.stage} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center relative z-10">
                            {/* Step Indicator Node */}
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                                step.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/5"
                                  : step.status === "current"
                                  ? "bg-indigo-600 text-white ring-4 ring-indigo-500/20 border border-indigo-400 shadow-lg shadow-indigo-500/20"
                                  : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                              }`}
                            >
                              {step.status === "completed" ? (
                                <svg className="w-4 h-4 text-emerald-400 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                i + 1
                              )}
                            </div>
                            
                            {/* Step Label */}
                            <span
                              className={`text-xs mt-3 whitespace-nowrap font-medium transition-colors ${
                                step.status === "upcoming"
                                  ? "text-zinc-500"
                                  : "text-zinc-200 font-semibold"
                              }`}
                            >
                              {step.stage}
                            </span>
                          </div>

                          {/* Connecting Line */}
                          {i < app.steps.length - 1 && (
                            <div className="flex-1 mx-2 relative h-0.5">
                              <div
                                className={`absolute inset-0 transition-all duration-500 ${
                                  step.status === "completed"
                                    ? "bg-emerald-500"
                                    : "bg-zinc-800"
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
