"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type CoursesJson,
  decodeParam,
  formatSemesterLabel,
} from "@/lib/catalog";

export default function SemesterPage() {
  const params = useParams<{ semester: string | string[] }>();
  const semesterKey = decodeParam(params.semester);

  const [courses, setCourses] = useState<CoursesJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/courses.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load courses.json (HTTP ${res.status})`);
        const json = (await res.json()) as CoursesJson;
        if (!cancelled) setCourses(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const semester = courses?.CSE_Syllabus_ASTU?.[semesterKey];

  const subjects = useMemo(() => {
    return semester?.subjects?.map((s) => s.name) ?? [];
  }, [semester]);

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <header className="mb-6">
          <div className="mb-2">
            <Link href="/" className="text-sm opacity-80 hover:opacity-100">
              ← Home
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatSemesterLabel(semesterKey)}
          </h1>
          <p className="text-sm opacity-80">{semester?.focus ?? "Choose a subject."}</p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-danger bg-danger-weak p-4 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="card p-6">
          <h2 className="mb-4 text-sm font-medium text-text-primary">Subjects</h2>
          {isLoading ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : !semester ? (
            <div className="text-sm opacity-70">
              Semester not found in `public/courses.json`.
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-sm opacity-70">No subjects listed.</div>
          ) : (
            <div className="space-y-3">
              {semester.subjects.map((s) => (
                <Link
                  key={s.name}
                  href={`/sem/${encodeURIComponent(semesterKey)}/${encodeURIComponent(s.name)}`}
                  className="card card-hover block p-5 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-text-primary text-lg">{s.name}</div>
                      <div className="mt-1.5 text-sm opacity-80 leading-relaxed max-w-2xl">{s.context ?? "Open subject"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 sm:mt-0 sm:justify-end shrink-0">
                      {s.course_code && (
                        <span className="inline-flex items-center rounded-full bg-surface-hover px-2.5 py-0.5 text-xs font-semibold text-text-secondary border border-divider">
                          {s.course_code}
                        </span>
                      )}
                      {s.is_elective && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          Elective
                        </span>
                      )}
                      {s.system_track && (
                        <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-500 dark:text-orange-400">
                          System Track
                        </span>
                      )}
                      {s.lab_component && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Lab
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
