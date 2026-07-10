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
  skills: string[];
  insights: any;
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

  if (loading) return <p className="p-8 text-gray-500">Loading...</p>;
  if (!data) return <p className="p-8 text-gray-500">Could not load job.</p>;

  const applicants = data.pipeline[activeStage] || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/hr")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              status === "live"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {status}
          </span>
          {status !== "live" && (
            <button
              onClick={makeLive}
              className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
            >
              Make live
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          {data.job_title}
        </h1>

        <div className="flex gap-2 border-b mb-6 overflow-x-auto">
          {data.stages.map((stage) => (
            <button
              key={stage}
              onClick={() => setActiveStage(stage)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
                activeStage === stage
                  ? "border-blue-600 text-blue-600 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {stage} ({data.counts[stage] || 0})
            </button>
          ))}
        </div>

        {applicants.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
            No candidates in {activeStage}.
          </div>
        ) : (
          <div className="space-y-4">
            {applicants.map((a) => (
              <div key={a.application_id} className="bg-white border rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{a.name}</h3>
                    <p className="text-sm text-gray-500">{a.email}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">
                        {a.ats_score}
                      </div>
                      <div className="text-xs text-gray-400">ATS</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-gray-900">
                        {(a.compatibility_score * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-400">Match</div>
                    </div>
                  </div>
                </div>

                {a.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {a.skills.slice(0, 8).map((s, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Move to:</span>
                  <select
                    value={activeStage}
                    onChange={(e) => moveStage(a.application_id, e.target.value)}
                    className="text-sm border rounded-md px-2 py-1 text-gray-900"
                  >
                    {data.stages.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
