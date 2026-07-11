"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";

type Job = {
  id: number;
  title: string;
  description: string;
  salary_min: number;
  salary_max: number;
  experience_required: number;
  skills: string[];
  rounds: number;
};

export default function CandidateJobDetail() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    if (savedRole !== "candidate") {
      router.push("/login");
      return;
    }
    api
      .get(`/jobs/${jobId}`)
      .then((res) => setJob(res.data))
      .catch(() => setJob(null))
      .finally(() => setLoading(false));

    // check if already applied to this job
    api
      .get("/my-applications")
      .then((res) => {
        const applied = res.data.some(
          (a: any) => String(a.job_id) === String(jobId)
        );
        setAlreadyApplied(applied);
      })
      .catch(() => {});
  }, [jobId, router]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setMessage("");
    setApplying(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await api.post(`/jobs/${jobId}/apply`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(res.data.message || "Application submitted!");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(", ")
          : "Could not apply"
      );
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-zinc-400 font-medium">Loading details...</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <svg className="w-12 h-12 text-red-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-zinc-200 font-semibold text-lg">Job post not found</p>
        <button
          onClick={() => router.push("/jobs")}
          className="rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 hover:bg-zinc-800 transition-colors text-sm"
        >
          Back to roles
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-12">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[250px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center border-b border-zinc-900">
        <button
          onClick={() => router.push("/jobs")}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l-7-7m7 7h18" />
          </svg>
          Back to Roles
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 relative z-10 space-y-6">
        {/* Job Header Info */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-zinc-400">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span>₹</span>
              {job.salary_min?.toLocaleString()}–{job.salary_max?.toLocaleString()}
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {job.experience_required}+ yrs exp
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 00-2 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 00-2 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {job.rounds} rounds
            </span>
          </div>
        </div>

        {/* Job Details Card */}
        <div className="bg-zinc-900/35 border border-zinc-900/90 rounded-xl p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Job Description
            </h2>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {job.description}
            </p>
          </div>

          {job.skills?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-900">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((s, i) => (
                  <span
                    key={i}
                    className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-md font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Application Form Card */}
        <div className="bg-zinc-900/35 border border-zinc-900/90 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200">
            Submit Your Application
          </h2>

          {alreadyApplied ? (
            <div className="text-sm text-indigo-300 bg-indigo-950/30 border border-indigo-900/50 rounded-lg px-4 py-3 flex items-start gap-2.5">
              <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span>You&apos;ve already applied to this role. </span>
                <button
                  onClick={() => router.push("/my-applications")}
                  className="underline font-semibold hover:text-indigo-200 transition-colors ml-1 cursor-pointer"
                >
                  Track your application
                </button>
              </div>
            </div>
          ) : message ? (
            <div className="text-sm text-emerald-300 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-4 py-3 flex items-start gap-2.5">
              <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span>{message} </span>
                <button
                  onClick={() => router.push("/my-applications")}
                  className="underline font-semibold hover:text-emerald-200 transition-colors ml-1 cursor-pointer"
                >
                  Track it here
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleApply} className="space-y-4">
              {error && (
                <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Styled File Upload Zone */}
              <label className="border-2 border-dashed border-zinc-800 hover:border-zinc-700/80 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group text-center block relative">
                <input
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                  className="sr-only"
                />
                <svg className="w-10 h-10 text-zinc-500 group-hover:text-indigo-400 transition-colors mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-200">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB · Click to change file</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-300">Click to upload resume</p>
                    <p className="text-xs text-zinc-500">PDF, DOCX, PNG, JPG or TXT (Max 10MB)</p>
                  </div>
                )}
              </label>

              <button
                type="submit"
                disabled={applying || !file}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:from-indigo-600 disabled:hover:to-violet-600 flex items-center justify-center gap-2 cursor-pointer"
              >
                {applying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  "Submit Application"
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
