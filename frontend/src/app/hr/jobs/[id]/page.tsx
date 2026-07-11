"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";

type Applicant = {
  application_id: number;
  name: string;
  email: string;
  ats_score: number;
  compatibility_score: number;
  current_stage: string;
  summary: string;
  skills: string[];
  insights: {
    graduation_year?: number | null;
    total_experience_years?: number | null;
    current_status?: string;
    education?: { college?: string; degree?: string; duration?: string }[];
    jobs?: { company?: string; role?: string; duration_months?: number; start?: string; end?: string }[];
    employment_gaps?: { gap_months?: number; between?: string }[];
    avg_tenure_months?: number | null;
    red_flags?: string[];
  } | null;
};

type Pipeline = {
  job_title: string;
  stages: string[];
  counts: Record<string, number>;
  pipeline: Record<string, Applicant[]>;
};

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [data, setData] = useState<Pipeline | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>("");

  const loadPipeline = () => {
    api
      .get(`/jobs/${jobId}/pipeline`)
      .then((res) => {
        setData(res.data);
        setActiveStage((prev) => prev || res.data.stages[0]);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    if (savedRole !== "hr") {
      router.push("/login");
      return;
    }
    api
      .get(`/jobs/${jobId}`)
      .then((res) => setStatus(res.data.status))
      .catch(() => {});
    loadPipeline();
  }, [jobId, router]);

  const makeLive = async () => {
    await api.patch(`/jobs/${jobId}/status`, { status: "live" });
    setStatus("live");
  };

  const moveStage = async (applicationId: number, stage: string) => {
    await api.patch(`/applications/${applicationId}/stage`, { stage });
    loadPipeline();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-zinc-400 font-medium">Loading pipeline...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <svg className="w-12 h-12 text-red-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-zinc-200 font-semibold text-lg">Job pipeline details could not be loaded</p>
        <button
          onClick={() => router.push("/hr")}
          className="rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2 hover:bg-zinc-800 transition-colors text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const applicants = data.pipeline[activeStage] || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden pb-12">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[250px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center border-b border-zinc-900 justify-between">
        <button
          onClick={() => router.push("/hr")}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l-7-7m7 7h18" />
          </svg>
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-wide uppercase border ${
              status === "live"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-zinc-900 text-zinc-500 border-zinc-800"
            }`}
          >
            {status}
          </span>
          {status !== "live" && (
            <button
              onClick={makeLive}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              Make live
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 relative z-10 space-y-6">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
          {data.job_title}
        </h1>

        {/* Horizontal Scrollable Stages Tabs */}
        <div className="flex gap-2 border-b border-zinc-900 mb-6 overflow-x-auto scrollbar-none">
          {data.stages.map((stage) => (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-all ${
                activeStage === stage
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {stage} <span className="ml-1 text-xs opacity-70">({data.counts[stage] || 0})</span>
            </button>
          ))}
        </div>

        {/* Applicants Grid/List */}
        {applicants.length === 0 ? (
          <div className="glass-panel border border-zinc-900 rounded-2xl p-12 text-center text-zinc-500 max-w-md mx-auto space-y-3">
            <svg className="w-12 h-12 text-zinc-700 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-zinc-400 font-medium">No candidates in {activeStage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applicants.map((a) => (
              <div key={a.application_id} className="bg-zinc-900/35 border border-zinc-900/90 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-200 hover:border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-zinc-100">{a.name}</h3>
                    <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {a.email}
                    </p>
                  </div>
                  
                  {/* Score Badges */}
                  <div className="flex gap-3 text-sm self-start sm:self-center">
                    <div className="bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2 text-center min-w-[72px] shadow-lg">
                      <div className="text-lg font-extrabold text-indigo-400">
                        {a.ats_score}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">ATS Score</div>
                    </div>
                    
                    <div className="bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2 text-center min-w-[72px] shadow-lg">
                      <div className="text-lg font-extrabold text-emerald-400">
                        {(a.compatibility_score * 100).toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">JD Match</div>
                    </div>
                  </div>
                </div>

                {/* Candidate Skills tags */}
                {a.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {a.skills.slice(0, 8).map((s, i) => (
                      <span
                        key={i}
                        className="text-xs bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-0.5 rounded-md font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                                {/* Structured candidate profile */}
                {a.insights && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Experience & Gaps */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                          Experience
                        </p>
                        <p className="text-sm text-zinc-300">
                          {a.insights.total_experience_years != null
                            ? `${a.insights.total_experience_years} yrs`
                            : "—"}
                          {a.insights.current_status ? ` · ${a.insights.current_status}` : ""}
                        </p>
                      </div>

                      {a.insights.employment_gaps && a.insights.employment_gaps.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider mb-1">
                            Gaps
                          </p>
                          {a.insights.employment_gaps.map((g, i) => (
                            <p key={i} className="text-xs text-zinc-400">
                              {g.gap_months} mo — {g.between}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Education */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 space-y-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Education
                      </p>
                      {a.insights.education && a.insights.education.length > 0 ? (
                        a.insights.education.map((e, i) => (
                          <div key={i} className="text-sm">
                            <p className="text-zinc-200 font-medium">{e.degree || "—"}</p>
                            <p className="text-xs text-zinc-400">
                              {e.college}
                              {e.duration ? ` · ${e.duration}` : ""}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">
                          {a.insights.graduation_year
                            ? `Graduated ${a.insights.graduation_year}`
                            : "—"}
                        </p>
                      )}
                    </div>

                    {/* Work history — full width */}
                    {a.insights.jobs && a.insights.jobs.length > 0 && (
                      <div className="md:col-span-2 bg-zinc-950 border border-zinc-900 rounded-xl p-4">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                          Work history
                        </p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] text-zinc-600 uppercase tracking-wider text-left">
                              <th className="pb-1 font-semibold">Company</th>
                              <th className="pb-1 font-semibold">Role</th>
                              <th className="pb-1 font-semibold">Period</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.insights.jobs.map((j, i) => (
                              <tr key={i} className="border-t border-zinc-900/60">
                                <td className="py-1.5 text-zinc-300">{j.company || "—"}</td>
                                <td className="py-1.5 text-zinc-400">{j.role || "—"}</td>
                                <td className="py-1.5 text-zinc-400">
                                  {j.start || "?"} – {j.end || "?"}
                                  {j.duration_months ? ` (${j.duration_months} mo)` : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Recruiter Summary box */}
                {a.summary && (
                  <div className="mt-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl p-4 space-y-1 relative overflow-hidden">
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Recruiter Summary
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed font-normal">
                      {a.summary}
                    </p>
                  </div>
                )}

                {/* Stage transition controls */}
                <div className="mt-5 pt-4 border-t border-zinc-900/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Move to:</span>
                    <div className="relative">
                      <select
                        value={activeStage}
                        onChange={(e) => moveStage(a.application_id, e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                      >
                        {data.stages.map((s) => (
                          <option key={s} value={s} className="bg-zinc-900 text-zinc-100">
                            {s}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zinc-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Detail link/actions could go here but let's keep exact original structure */}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
