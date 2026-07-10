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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">HR Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/hr/post-job"
            className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            + Post a job
          </Link>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-sm font-medium text-gray-500 mb-4">My jobs</h2>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
            No jobs yet. Post your first job to start receiving applications.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/hr/jobs/${job.id}`}
                className="block bg-white border rounded-xl p-5 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {job.rounds} rounds · {job.applicant_count} applicant
                      {job.applicant_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      job.status === "live"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
