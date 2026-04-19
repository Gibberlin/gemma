"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CoursesJson,
  formatSemesterLabel,
  semesterSortKey,
} from "@/lib/catalog";
import LoadingScreen from "@/app/components/LoadingScreen";

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CoursesJson | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        // Add a slight delay so the boot screen animation can be enjoyed
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const res = await fetch("/courses.json", { cache: "no-store" });
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

  const semesters = useMemo(() => {
    const keys = courses ? Object.keys(courses.CSE_Syllabus_ASTU ?? {}) : [];
    return keys.slice().sort((a, b) => semesterSortKey(a) - semesterSortKey(b));
  }, [courses]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
            Gemma Study Companion 🤖
          </h1>
          <p className="mt-2 text-xl sm:text-2xl md:text-3xl opacity-80">
            Choose a semester, then pick a subject.
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-danger bg-danger-weak p-4 text-base sm:text-lg text-danger">
            {error}
          </div>
        ) : null}

        <div className="card p-4 sm:p-6">
          <h2 className="mb-4 text-base sm:text-lg font-medium text-text-primary">Semesters</h2>
          {semesters.length === 0 ? (
            <div className="text-base sm:text-lg opacity-70">No semesters found in `public/courses.json`.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {semesters.map((semesterKey) => (
                <Link
                  key={semesterKey}
                  href={`/sem/${semesterKey}`}
                  className="card card-hover p-4 sm:p-6"
                >
                  <div className="font-medium text-text-primary text-base sm:text-lg">
                    {formatSemesterLabel(semesterKey)}
                  </div>
                  <div className="mt-1 text-xs sm:text-sm opacity-80">
                    {courses?.CSE_Syllabus_ASTU?.[semesterKey]?.focus ?? "View subjects"}
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
