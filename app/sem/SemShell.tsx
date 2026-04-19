"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiUser, FiMenu } from "react-icons/fi";
import { formatSemesterLabel, semesterSortKey } from "@/lib/catalog";

type Props = {
  semesters: string[];
  currentSemester?: string | null;
  children: React.ReactNode;
};

const COLLAPSED_WIDTH_CLASS = "w-16";
const EXPANDED_WIDTH_CLASS = "w-64";

function getDefaultCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("bvec.sidebar.collapsed") === "1";
  } catch {
    return false;
  }
}

export default function SemShell({ semesters, currentSemester, children }: Props) {
  const [collapsed, setCollapsed] = useState(getDefaultCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem("bvec.sidebar.collapsed", collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const orderedSemesters = useMemo(() => {
    return semesters.slice().sort((a, b) => semesterSortKey(a) - semesterSortKey(b));
  }, [semesters]);

  const contentOffsetClass = collapsed ? "pl-0 md:pl-16" : "pl-0 md:pl-64";
  const sidebarWidthClass = collapsed ? "-translate-x-full md:translate-x-0 w-64 md:w-16" : "translate-x-0 w-64";

  return (
    <div className={["h-screen overflow-hidden text-foreground", contentOffsetClass].join(" ")}>
      {!collapsed ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setCollapsed(true)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden transition-opacity"
        />
      ) : null}

      {/* Mobile open button */}
      {collapsed && (
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={() => setCollapsed(false)}
          className="md:hidden fixed bottom-6 right-6 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <FiMenu className="text-2xl" />
        </button>
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-40 h-screen",
          "border-r border-divider bg-surface shadow-sm",
          "transition-[width,transform] duration-200 ease-out",
          sidebarWidthClass,
        ].join(" ")}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center px-3 py-3">
            <button
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={false}
              onClick={() => setCollapsed(false)}
              className="relative flex grid h-10 w-10 place-items-center rounded-2xl border border-divider bg-surface text-text-primary transition-colors hover:bg-background"
            >
              <FiChevronRight className="text-2xl opacity-70" />
              <div className="pointer-events-none mt-9 absolute inset-0 grid place-items-center px-1 text-center text-[9px] font-semibold leading-none">
                Study Hub
              </div>
            </button>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-background text-text-primary">
                  <span className="text-sm font-semibold">B</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">
                    BVEC Study Hub
                  </div>
                  <div className="truncate text-xs opacity-70">Semesters</div>
                </div>
              </div>

              <button
                type="button"
                aria-label="Collapse sidebar"
                aria-expanded={true}
                onClick={() => setCollapsed(true)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-divider bg-surface text-text-primary transition-colors hover:bg-background"
              >
                <FiChevronLeft />
              </button>
            </div>

            <div className="px-3">
              <div className="h-px bg-divider" />
            </div>

            <nav
              aria-label="Semester navigation"
              className="flex-1 overflow-y-auto px-2 py-3"
            >
              <ul className="space-y-1">
                {orderedSemesters.map((semesterKey) => {
                  const isActive = currentSemester === semesterKey;
                  const label = formatSemesterLabel(semesterKey);
                  return (
                    <li key={semesterKey}>
                      <Link
                        href={`/sem/${encodeURIComponent(semesterKey)}`}
                        onClick={() => {
                          if (typeof window !== "undefined" && window.innerWidth < 768) {
                            setCollapsed(true);
                          }
                        }}
                        className={[
                          "group flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "border-primary bg-primary-weak text-text-primary"
                            : "border-transparent hover:border-divider hover:bg-background",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                            isActive
                              ? "bg-primary text-white"
                              : "bg-background text-text-primary",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <span className="text-xs font-semibold">
                            {semesterKey.match(/\d+/)?.[0] ?? "S"}
                          </span>
                        </span>
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="px-3 pb-3">
              <div className="h-px bg-divider" />
              <div className="mt-3">
                <Link
                  href="#"
                  className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-sm text-text-primary transition-colors hover:border-divider hover:bg-background"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-background">
                    <FiUser />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">Account</span>
                    <span className="truncate text-xs opacity-70">Sign In</span>
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main className="h-screen overflow-y-auto">{children}</main>
    </div>
  );
}
