"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Job = {
  id: number;
  title: string;
  status: string;
  rounds: number;
  applicant_count: number;
};

export default function HRDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    if (!savedRole) {
      router.push("/login");
      return;
    }
    if (savedRole !== "hr") {
      router.push("/jobs");
      return;
    }

    api
      .get("/jobs/mine")
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-12">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[250px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-900">
        <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
          Hiring Dashboard
        </h1>
        <div className="flex items-center gap-6">
          <Link
            href="/hr/post-job"
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2 text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all duration-300 transform hover:scale-[1.02] flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Post a job
          </Link>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="text-sm font-medium text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 relative z-10">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-6">
          Active Job Openings
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-zinc-900/30 border border-zinc-900 rounded-xl p-6 space-y-3">
                <div className="h-5 bg-zinc-800/80 rounded w-1/4" />
                <div className="h-4 bg-zinc-900 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass-panel border border-zinc-900 rounded-2xl p-12 text-center text-zinc-400 max-w-md mx-auto space-y-4">
            <svg className="w-12 h-12 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <p className="text-zinc-300 font-medium mb-1">No jobs posted yet</p>
              <p className="text-sm text-zinc-500">Post your first job opening to start receiving and analyzing resumes.</p>
            </div>
            <Link
              href="/hr/post-job"
              className="inline-block rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 hover:bg-zinc-800 transition-all duration-200 text-sm font-semibold"
            >
              Post a job now
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/hr/jobs/${job.id}`}
                className="group block bg-zinc-900/35 border border-zinc-900/90 rounded-xl p-5 hover:border-zinc-800 hover:bg-zinc-900/50 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors text-base">
                      {job.title}
                    </h3>
                    <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                      <span>{job.rounds} Interview rounds</span>
                      <span className="text-zinc-700">•</span>
                      <span className="text-indigo-400 font-medium">
                        {job.applicant_count} candidate{job.applicant_count !== 1 ? "s" : ""}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase ${
                        job.status === "live"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                      }`}
                    >
                      {job.status}
                    </span>
                    <svg className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transform group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
