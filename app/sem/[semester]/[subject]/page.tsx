"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type CoursesJson,
  decodeParam,
  formatSemesterLabel,
} from "@/lib/catalog";

export default function SubjectHomePage() {
  const params = useParams<{ semester: string | string[]; subject: string | string[] }>();
  const semesterKey = decodeParam(params.semester);
  const subjectName = decodeParam(params.subject);

  const [courses, setCourses] = useState<CoursesJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
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

  const semester = courses?.CSE_Syllabus_ASTU?.[semesterKey];

  const subject = useMemo(() => {
    return semester?.subjects?.find((s) => s.name === subjectName);
  }, [semester, subjectName]);

  const subjectBase = `/sem/${encodeURIComponent(semesterKey)}/${encodeURIComponent(subjectName)}`;

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href={`/sem/${encodeURIComponent(semesterKey)}`}
              className="text-xs sm:text-sm opacity-80 hover:opacity-100"
            >
              ← {formatSemesterLabel(semesterKey)}
            </Link>
            <span className="text-xs sm:text-sm opacity-60">/</span>
            <span className="text-xs sm:text-sm opacity-80">{subjectName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight mt-1">{subjectName}</h1>
          <p className="text-xs sm:text-sm opacity-80 mt-1.5">
            {isLoading ? "Loading…" : subject?.context ?? "Pick an option."}
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-danger bg-danger-weak p-4 text-xs sm:text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href={`${subjectBase}/materials`} className="card card-hover p-4 sm:p-6">
            <div className="font-medium text-text-primary text-base sm:text-lg">Materials</div>
            <div className="mt-1 text-xs sm:text-sm opacity-80">
              Books, Youtube lectures, NPTEL videos and more to study the subject.
            </div>
          </Link>

          <Link href={`${subjectBase}/qa`} className="card card-hover p-4 sm:p-6">
            <div className="font-medium text-text-primary text-base sm:text-lg">Subject Q&amp;A</div>
            <div className="mt-1 text-xs sm:text-sm opacity-80">
              Ask questions related to this subject and get answers from LLM based on Gemma. disclaimer: The project works best with LMstudios with Gemma 4.
            </div>
          </Link>
        </div>

        {!isLoading && (!semester || !subject) ? (
          <div className="card mt-4 p-4 sm:p-6 text-xs sm:text-sm opacity-80">
            This subject/semester pair wasn’t found in `public/courses.json` (links still work if you want to add it).
          </div>
        ) : null}
      </div>
    </div>
  );
}
