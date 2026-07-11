"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Job = {
  id: number;
  title: string;
  salary_min: number;
  salary_max: number;
  experience_required: number;
  skills: string[];
  rounds: number;
};

export default function JobsPage() {
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
    api
      .get("/jobs")
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[250px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-900">
        <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Open Roles
        </h1>
        <div className="flex items-center gap-6">
          <Link href="/my-applications" className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">
            My Applications
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
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-zinc-900/30 border border-zinc-900 rounded-xl p-6 space-y-3">
                <div className="h-5 bg-zinc-800/80 rounded w-1/3" />
                <div className="h-4 bg-zinc-900 rounded w-1/2" />
                <div className="flex gap-2 pt-2">
                  <div className="h-5 bg-zinc-900 rounded w-16" />
                  <div className="h-5 bg-zinc-900 rounded w-16" />
                  <div className="h-5 bg-zinc-900 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass-panel border border-zinc-900 rounded-2xl p-12 text-center text-zinc-400 max-w-md mx-auto space-y-3">
            <svg className="w-12 h-12 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2M4 18h16" />
            </svg>
            <p className="text-zinc-300 font-medium">No open roles right now</p>
            <p className="text-sm text-zinc-500">Check back later for new opportunities.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="group block bg-zinc-900/35 border border-zinc-900/90 rounded-xl p-6 transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/50 hover:scale-[1.005] hover:shadow-lg hover:shadow-black/20"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                      {job.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-zinc-400">
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <span>₹</span>
                        {job.salary_min?.toLocaleString()}–{job.salary_max?.toLocaleString()}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {job.experience_required}+ yrs exp
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 00-2 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        {job.rounds} rounds
                      </span>
                    </div>

                    {job.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-3">
                        {job.skills.slice(0, 8).map((s, i) => (
                          <span
                            key={i}
                            className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-0.5 rounded-md transition-colors group-hover:border-zinc-700/60"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-zinc-500 group-hover:text-zinc-300 transition-colors pt-1">
                    <svg className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
