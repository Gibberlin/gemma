import { readFile } from "node:fs/promises";
import path from "node:path";
import SemShell from "@/app/sem/SemShell";
import { decodeParam, semesterSortKey, type CoursesJson } from "@/lib/catalog";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ semester?: string | string[] }>;
};

async function loadSemesters(): Promise<string[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "courses.json");
    const raw = await readFile(filePath, "utf8");
    const json = JSON.parse(raw) as CoursesJson;
    const keys = Object.keys(json?.CSE_Syllabus_ASTU ?? {});
    return keys.slice().sort((a, b) => semesterSortKey(a) - semesterSortKey(b));
  } catch {
    return [];
  }
}

export default async function SemLayout({ children, params }: LayoutProps) {
  const semesters = await loadSemesters();
  const resolvedParams = await params;
  const currentSemester = resolvedParams.semester ? decodeParam(resolvedParams.semester) : null;

  return (
    <SemShell semesters={semesters} currentSemester={currentSemester}>
      {children}
    </SemShell>
  );
}
