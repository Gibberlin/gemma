import React, { useState, useEffect } from "react";
import { X, FileText, Check } from "lucide-react";

interface Subject {
  name: string;
  course_code?: string;
}

interface SemesterData {
  subjects: Subject[];
}

interface SyllabusData {
  CSE_Syllabus_ASTU: Record<string, SemesterData>;
}

interface NoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    semester: string;
    subjectCode: string;
    subjectName: string;
    format: string;
    content?: string;
    filePath?: string;
    isDocument?: boolean;
  }) => void;
  syllabus: SyllabusData | null;
  prefilledData?: {
    title?: string;
    semester?: string;
    subjectCode?: string;
    subjectName?: string;
    format?: string;
    content?: string;
    filePath?: string;
    isDocument?: boolean;
  };
  isUpload?: boolean;
}

const NOTE_FORMATS = [
  "Own notes",
  "Teacher note",
  "Presentation",
  "Image files",
  "Other"
];

export default function NoteFormModal({
  isOpen,
  onClose,
  onSubmit,
  syllabus,
  prefilledData = {},
  isUpload = false,
}: NoteFormModalProps) {
  const [title, setTitle] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState("Own notes");

  // Get semesters list
  const semestersList = syllabus
    ? Object.keys(syllabus.CSE_Syllabus_ASTU).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "999");
        const numB = parseInt(b.match(/\d+/)?.[0] || "999");
        return numA - numB;
      })
    : [];

  // Update fields when modal opens or prefilledData changes
  useEffect(() => {
    if (isOpen) {
      setTitle(prefilledData.title || "");
      setSelectedFormat(prefilledData.format || "Own notes");
      
      const initialSem = prefilledData.semester || semestersList[0] || "";
      setSelectedSemester(initialSem);
      
      // Attempt to find subject match in prefilled data
      if (syllabus && initialSem && syllabus.CSE_Syllabus_ASTU[initialSem]) {
        const subjects = syllabus.CSE_Syllabus_ASTU[initialSem].subjects;
        const matchedIndex = subjects.findIndex(
          (sub) => sub.name === prefilledData.subjectName
        );
        setSelectedSubjectIndex(matchedIndex >= 0 ? matchedIndex : 0);
      } else {
        setSelectedSubjectIndex(0);
      }
    }
  }, [isOpen, prefilledData, syllabus]);

  if (!isOpen) return null;

  // Active subjects list based on selected semester
  const activeSubjects =
    syllabus && selectedSemester && syllabus.CSE_Syllabus_ASTU[selectedSemester]
      ? syllabus.CSE_Syllabus_ASTU[selectedSemester].subjects
      : [];

  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sem = e.target.value;
    setSelectedSemester(sem);
    setSelectedSubjectIndex(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const currentSubject = activeSubjects[selectedSubjectIndex] || { name: "General Notes", course_code: "" };

    onSubmit({
      title: title.trim(),
      semester: selectedSemester,
      subjectCode: currentSubject.course_code || "",
      subjectName: currentSubject.name,
      format: selectedFormat,
      content: prefilledData.content || "", // Preserve content if uploaded
      filePath: prefilledData.filePath,
      isDocument: prefilledData.isDocument,
    });
  };

  const cleanTitle = (raw: string) => {
    return raw.replace(/_/g, " ");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "500px",
          width: "90%",
          padding: "1.75rem",
          borderRadius: "16px",
          border: "1px solid var(--divider)",
          background: "var(--bg-surface)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="modal-header" style={{ borderBottom: "1px solid var(--divider)", paddingBottom: "1rem" }}>
          <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileText size={18} className="text-primary" />
            <span>{isUpload ? "Upload Note Details" : "Create New Note"}</span>
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* Title Input */}
          <div className="login-input-group">
            <label className="login-label">Note Title</label>
            <div className="login-input-wrapper">
              <input
                type="text"
                className="login-input"
                placeholder="e.g. Lecture 1 Summary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Semester Selector */}
          <div className="login-input-group">
            <label className="login-label">Semester</label>
            <div className="login-input-wrapper" style={{ paddingLeft: "0.75rem" }}>
              <select
                className="login-input"
                style={{ paddingLeft: "0.25rem", background: "transparent", border: "none", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                value={selectedSemester}
                onChange={handleSemesterChange}
              >
                {semestersList.map((sem) => (
                  <option key={sem} value={sem} style={{ background: "var(--bg-primary)" }}>
                    {cleanTitle(sem)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject Selector */}
          <div className="login-input-group">
            <label className="login-label">Subject</label>
            <div className="login-input-wrapper" style={{ paddingLeft: "0.75rem" }}>
              <select
                className="login-input"
                style={{ paddingLeft: "0.25rem", background: "transparent", border: "none", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                value={selectedSubjectIndex}
                onChange={(e) => setSelectedSubjectIndex(parseInt(e.target.value))}
              >
                {activeSubjects.length === 0 ? (
                  <option value={0}>General Notes</option>
                ) : (
                  activeSubjects.map((sub, idx) => (
                    <option key={idx} value={idx} style={{ background: "var(--bg-primary)" }}>
                      {sub.course_code ? `[${sub.course_code}] ` : ""}{sub.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Note Format Selector */}
          <div className="login-input-group">
            <label className="login-label">Note Format</label>
            <div className="login-input-wrapper" style={{ paddingLeft: "0.75rem" }}>
              <select
                className="login-input"
                style={{ paddingLeft: "0.25rem", background: "transparent", border: "none", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
              >
                {NOTE_FORMATS.map((format) => (
                  <option key={format} value={format} style={{ background: "var(--bg-primary)" }}>
                    {format}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            className="login-submit-btn"
            style={{
              marginTop: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <Check size={16} />
            <span>Confirm and Save</span>
          </button>
        </form>
      </div>
    </div>
  );
}
