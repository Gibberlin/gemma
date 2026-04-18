"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  type MaterialsJson,
  decodeParam,
  formatSemesterLabel,
} from "@/lib/catalog";

export default function MaterialsPage() {
  const params = useParams<{ semester: string | string[]; subject: string | string[] }>();
  const semesterKey = decodeParam(params.semester);
  const subjectName = decodeParam(params.subject);

  const [materials, setMaterials] = useState<MaterialsJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/materials.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load materials.json (HTTP ${res.status})`);
        const json = (await res.json()) as MaterialsJson;
        if (!cancelled) setMaterials(json);
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

  const semester = materials?.semesters?.[semesterKey];

  const subjectMaterial = useMemo(() => {
    if (!semester?.subjects) return null;
    return semester.subjects[subjectName] ?? null;
  }, [semester, subjectName]);

  const backHref = `/sem/${encodeURIComponent(semesterKey)}/${encodeURIComponent(subjectName)}`;

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <header className="mb-6">
          <div className="mb-2">
            <Link href={backHref} className="text-sm opacity-80 hover:opacity-100">
              ← {subjectName}
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Materials</h1>
          <p className="text-sm opacity-80">
            {formatSemesterLabel(semesterKey)} • {subjectName}
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-danger bg-danger-weak p-4 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="card p-6 space-y-4">
          {isLoading ? (
            <div className="text-sm opacity-70">Loading…</div>
          ) : !materials ? (
            <div className="text-sm opacity-70">No materials loaded.</div>
          ) : !semester ? (
            <div className="text-sm opacity-70">
              Semester not found in `public/materials.json`.
            </div>
          ) : !subjectMaterial ? (
            <div className="text-sm opacity-70">
              No material entry found for this subject in `public/materials.json`.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-divider bg-background p-5">
                <div className="text-sm opacity-70 mb-1">Module reference</div>
                <div className="font-medium text-text-primary">
                  {subjectMaterial.module_ref ?? "—"}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  className="card card-hover p-6"
                  href={subjectMaterial.pdf ?? semester.pdf ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="font-medium text-text-primary">Subject PDF</div>
                  <div className="mt-1 text-sm opacity-80 break-words">
                    {subjectMaterial.pdf ?? semester.pdf ?? "No PDF link"}
                  </div>
                </a>

                <a
                  className="card card-hover p-6"
                  href={semester.pdf ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="font-medium text-text-primary">Semester PDF</div>
                  <div className="mt-1 text-sm opacity-80 break-words">
                    {semester.pdf ?? "No PDF link"}
                  </div>
                </a>
              </div>

              {materials.base_source ? (
                <a
                  className="block text-sm opacity-80 hover:opacity-100 underline underline-offset-4"
                  href={materials.base_source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source: {materials.base_source}
                </a>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
