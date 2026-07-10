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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Open roles</h1>
        <div className="flex items-center gap-3">
          <Link href="/my-applications" className="text-sm text-gray-600 hover:text-gray-900">
            My applications
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
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center text-gray-500">
            No open roles right now. Check back later.
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block bg-white border rounded-xl p-5 hover:shadow-sm transition"
              >
                <h3 className="font-medium text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  ₹{job.salary_min?.toLocaleString()}–{job.salary_max?.toLocaleString()} ·{" "}
                  {job.experience_required}+ yrs · {job.rounds} rounds
                </p>
                {job.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {job.skills.slice(0, 6).map((s, i) => (
                      <span
                        key={i}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
