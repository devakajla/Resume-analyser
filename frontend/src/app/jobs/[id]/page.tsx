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

  if (loading) return <p className="p-8 text-gray-500">Loading...</p>;
  if (!job) return <p className="p-8 text-gray-500">Job not found.</p>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <button
          onClick={() => router.push("/jobs")}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to roles
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-gray-900">{job.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          ₹{job.salary_min?.toLocaleString()}–{job.salary_max?.toLocaleString()} ·{" "}
          {job.experience_required}+ yrs · {job.rounds} rounds
        </p>

        <div className="bg-white border rounded-xl p-6 mt-6">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Description</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{job.description}</p>

          {job.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-4">
              {job.skills.map((s, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-xl p-6 mt-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Apply</h2>

          {message ? (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
              {message}{" "}
              <button
                onClick={() => router.push("/my-applications")}
                className="underline"
              >
                Track it
              </button>
            </p>
          ) : (
            <form onSubmit={handleApply} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <input
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                className="block w-full text-sm text-gray-600"
              />
              <button
                type="submit"
                disabled={applying || !file}
                className="rounded-md bg-blue-600 text-white px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {applying ? "Submitting..." : "Submit application"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
