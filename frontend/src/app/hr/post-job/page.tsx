"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function PostJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [experience, setExperience] = useState("");
  const [rounds, setRounds] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    if (savedRole !== "hr") router.push("/login");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/jobs", {
        title,
        description,
        salary_min: Number(salaryMin),
        salary_max: Number(salaryMax),
        experience_required: Number(experience),
        rounds: Number(rounds),
      });
      router.push("/hr");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(", ")
          : "Could not create job"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-12">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[250px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center border-b border-zinc-900">
        <button
          onClick={() => router.push("/hr")}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l-7-7m7 7h18" />
          </svg>
          Back to Dashboard
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 relative z-10 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Create Job opening
          </h1>
          <p className="text-sm text-zinc-400">
            Define requirements and description to start analyzing applicant fits
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900/35 border border-zinc-900/90 rounded-2xl p-8 space-y-5 shadow-xl relative overflow-hidden"
        >
          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Job Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Lead QA Engineer"
              className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={6}
              placeholder="Outline role responsibilities, key skills required, day-to-day work, etc."
              className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Salary Min (INR)
              </label>
              <input
                type="number"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                required
                placeholder="e.g. 800000"
                className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Salary Max (INR)
              </label>
              <input
                type="number"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                required
                placeholder="e.g. 1500000"
                className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Experience Required (years)
              </label>
              <input
                type="number"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                required
                placeholder="e.g. 3"
                className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Interview Rounds
              </label>
              <input
                type="number"
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                required
                placeholder="e.g. 4"
                className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:from-indigo-600 disabled:hover:to-violet-600 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Posting opening...</span>
              </>
            ) : (
              "Post opening"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
