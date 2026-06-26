import { useState, useEffect, useRef } from "react";
import {
  Settings,
  Paperclip,
  Send,
  Check,
  Copy,
  ExternalLink,
  XCircle,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  Message,
  GenerationSettings,
  generateContentStream,
} from "./api";
import SettingsModal from "./components/SettingsModal";
import ConfigurationPanel from "./components/ConfigurationPanel";
import "./App.css";

// Types for courses and materials JSON maps
interface Subject {
  name: string;
  course_code?: string;
  context?: string;
  difficulty?: string;
  lab_component?: boolean;
  system_track?: boolean;
  is_elective?: boolean;
}

interface SemesterData {
  focus: string;
  subjects: Subject[];
}

interface SyllabusData {
  system_role: string;
  CSE_Syllabus_ASTU: Record<string, SemesterData>;
}

interface SubjectMaterial {
  course_code?: string;
  module_ref?: string;
  pdf?: string;
  youtube?: string;
  nptel?: string;
  interactive?: string;
  pdf_source?: string;
  project_info?: string;
  books?: string[];
}

interface SemesterMaterial {
  pdf?: string;
  subjects: Record<string, SubjectMaterial>;
}

interface MaterialsData {
  description: string;
  base_source: string;
  semesters: Record<string, SemesterMaterial>;
  global_libraries: {
    ebook_search_engines: string[];
  };
}

interface DocumentAttachment {
  name: string;
  content: string;
  size: number;
}

// Default Configuration settings
const DEFAULT_SETTINGS: GenerationSettings = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
  temperature: 0.7,
  systemInstruction:
    "You are a helpful, precise academic assistant aligned with the official ASTU CSE syllabus. Address the user's questions clearly, showing code snippets where appropriate, and cite the syllabus where relevant.",
  customEndpoint: "",
};

// Splash Screen Component (12 bars loader)
function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [percent, setPercent] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const interval = setInterval(() => {
      setPercent((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(onFinish, 300);
          return 100;
        }
        return Math.min(p + Math.floor(Math.random() * 12 + 4), 100);
      });
    }, 150);
    return () => clearInterval(interval);
  }, [onFinish]);

  const activeBarsCount = Math.floor((percent / 100) * 12);

  return (
    <div className="splash-container">
      <div className={`splash-glow ${active ? "opacity-100" : "opacity-0"}`} />
      <div className="splash-content">
        <div className="splash-title-wrap">
          <h1 className="splash-title">Gemma</h1>
          <p className="splash-subtitle">Study Assistant</p>
        </div>
        <div className="splash-bars">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className={`splash-bar ${idx < activeBarsCount ? "active" : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [view, setView] = useState<"splash" | "introduction" | "home" | "semester" | "subject_landing" | "materials" | "qa">("splash");
  const [introStep, setIntroStep] = useState(1);
  
  // Courses and Materials data loaded from public/*.json
  const [syllabus, setSyllabus] = useState<SyllabusData | null>(null);
  const [materials, setMaterials] = useState<MaterialsData | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // Active navigation states
  const [currentSemester, setCurrentSemester] = useState<string | null>(null);
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null);
  
  // Settings configurations
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  
  // Chat States for Q&A view
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Document attachments state
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load static files and configurations on mount
  useEffect(() => {
    async function loadStaticData() {
      try {
        const syllabusRes = await fetch("/courses.json");
        if (!syllabusRes.ok) throw new Error("Could not load courses.json");
        const syllabusJson = await syllabusRes.json();
        setSyllabus(syllabusJson);

        const materialsRes = await fetch("/materials.json");
        if (!materialsRes.ok) throw new Error("Could not load materials.json");
        const materialsJson = await materialsRes.json();
        setMaterials(materialsJson);
      } catch (err: any) {
        console.error(err);
        setJsonError(err.message || "Failed to load courses metadata files.");
      }
    }
    
    // Load settings from local storage
    const saved = localStorage.getItem("gemma_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(merged);
        const configured = !!merged.provider && (merged.provider.startsWith("local") ? !!merged.customEndpoint : !!merged.apiKey);
        setHasConfig(configured);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }

    loadStaticData();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isGenerating]);

  // Clean title for display (e.g. Semester_3 -> Semester 3)
  const formatTitle = (title: string | null) => {
    if (!title) return "";
    return title.replace(/_/g, " ");
  };

  // List of semesters sorted logically
  const semestersList = syllabus
    ? Object.keys(syllabus.CSE_Syllabus_ASTU).sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "999");
        const numB = parseInt(b.match(/\d+/)?.[0] || "999");
        return numA - numB;
      })
    : [];

  // Reset active selections
  const navigateHome = () => {
    setCurrentSemester(null);
    setCurrentSubject(null);
    setView("home");
  };

  // Navigate to Semester
  const selectSemester = (sem: string) => {
    setCurrentSemester(sem);
    setCurrentSubject(null);
    setView("semester");
  };

  // Navigate to Subject
  const selectSubject = (sub: Subject) => {
    setCurrentSubject(sub);
    setView("subject_landing");
  };

  // Save Settings
  const handleSaveSettings = (newSettings: GenerationSettings) => {
    setSettings(newSettings);
    localStorage.setItem("gemma_settings", JSON.stringify(newSettings));
    const configured = !!newSettings.provider && (newSettings.provider.startsWith("local") ? !!newSettings.customEndpoint : !!newSettings.apiKey);
    setHasConfig(configured);
  };

  // File Upload parsing helper
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              content,
              size: file.size,
            },
          ]);
        }
      };
      reader.readAsText(file);
    });

    // Reset input value so same file can be uploaded again if deleted
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Format and Copy code block helper
  const handleCopyCode = (code: string, blockId: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(blockId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Inline markdown rendering helper
  const renderInlineMarkdown = (text: string): React.ReactNode[] => {
    const inlineRegex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const splitParts = text.split(inlineRegex);

    return splitParts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index} className="inline-code">{part.slice(1, -1)}</code>;
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a key={index} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline inline-flex items-center gap-0.5">
            {linkMatch[1]}
            <ExternalLink size={10} />
          </a>
        );
      }
      return part;
    });
  };

  // Custom regex block markdown parser supporting code blocks, headers, lists
  const renderBlockMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    const blockRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
    let lastIndex = 0;
    let match;
    let blockIdCounter = 0;

    while ((match = blockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textSegment = text.substring(lastIndex, match.index);
        parts.push(renderTextSegment(textSegment, `text-${lastIndex}`));
      }

      const language = match[1] || "code";
      const codeContent = match[2];
      const blockId = `code-${blockIdCounter++}-${match.index}`;

      parts.push(
        <div key={blockId} className="code-block-container">
          <div className="code-block-header">
            <span>{language.toUpperCase()}</span>
            <button onClick={() => handleCopyCode(codeContent, blockId)} className="copy-btn">
              {copiedId === blockId ? (
                <>
                  <Check size={12} className="text-teal-400" />
                  <span className="text-teal-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="code-block-content">
            <code>{codeContent}</code>
          </pre>
        </div>
      );

      lastIndex = blockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(renderTextSegment(remainingText, `text-end-${lastIndex}`));
    }

    return parts;
  };

  const renderTextSegment = (text: string, keyPrefix: string): React.ReactNode => {
    const lines = text.split("\n");
    const blocks: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let isInsideList = false;
    let listType: "ul" | "ol" = "ul";

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        if (listType === "ul") {
          blocks.push(<ul key={`ul-${key}`} style={{ marginLeft: "1.5rem", marginBottom: "0.75rem" }}>{...listItems}</ul>);
        } else {
          blocks.push(<ol key={`ol-${key}`} style={{ marginLeft: "1.5rem", marginBottom: "0.75rem" }}>{...listItems}</ol>);
        }
        listItems = [];
        isInsideList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("### ")) {
        flushList(`h3-${i}`);
        blocks.push(<h3 key={`h3-${i}`} style={{ margin: "1rem 0 0.5rem 0", color: "var(--text-primary)" }}>{renderInlineMarkdown(trimmed.substring(4))}</h3>);
      } else if (trimmed.startsWith("## ")) {
        flushList(`h2-${i}`);
        blocks.push(<h2 key={`h2-${i}`} style={{ margin: "1.2rem 0 0.6rem 0", color: "var(--text-primary)" }}>{renderInlineMarkdown(trimmed.substring(3))}</h2>);
      } else if (trimmed.startsWith("# ")) {
        flushList(`h1-${i}`);
        blocks.push(<h1 key={`h1-${i}`} style={{ margin: "1.5rem 0 0.75rem 0", color: "var(--text-primary)" }}>{renderInlineMarkdown(trimmed.substring(2))}</h1>);
      } else if (trimmed.startsWith("> ")) {
        flushList(`bq-${i}`);
        blocks.push(
          <blockquote key={`bq-${i}`} style={{ borderLeft: "4px solid var(--primary)", paddingLeft: "0.75rem", margin: "0.75rem 0", fontStyle: "italic", color: "var(--text-secondary)" }}>
            {renderInlineMarkdown(trimmed.substring(2))}
          </blockquote>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!isInsideList || listType !== "ul") {
          flushList(`flush-ul-${i}`);
          isInsideList = true;
          listType = "ul";
        }
        listItems.push(<li key={`li-${i}`} style={{ marginBottom: "0.25rem" }}>{renderInlineMarkdown(trimmed.substring(2))}</li>);
      } else if (/^\d+\.\s/.test(trimmed)) {
        if (!isInsideList || listType !== "ol") {
          flushList(`flush-ol-${i}`);
          isInsideList = true;
          listType = "ol";
        }
        const textAfterNumber = trimmed.replace(/^\d+\.\s/, "");
        listItems.push(<li key={`li-${i}`} style={{ marginBottom: "0.25rem" }}>{renderInlineMarkdown(textAfterNumber)}</li>);
      } else if (trimmed === "") {
        flushList(`empty-${i}`);
      } else {
        flushList(`p-flush-${i}`);
        blocks.push(<p key={`p-${i}`} style={{ marginBottom: "0.75rem" }}>{renderInlineMarkdown(line)}</p>);
      }
    }

    flushList(`final-${keyPrefix}`);

    return <div key={keyPrefix} className="markdown-body">{blocks}</div>;
  };

  // Send Chat message handling
  const handleSendChatMessage = async (inputText: string) => {
    if (!inputText.trim() && attachments.length === 0) return;

    let compiledContent = "";
    
    // If files are attached, parse and inject them inside code blocks
    if (attachments.length > 0) {
      compiledContent += "Here are the contents of the attached documents for context:\n\n";
      attachments.forEach((file) => {
        compiledContent += `[File: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      });
      compiledContent += "User's request:\n";
    }

    compiledContent += inputText;

    // Reset inputs
    setAttachments([]);

    const userMsg: Message = { role: "user", content: compiledContent };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setIsGenerating(true);
    setChatError(null);

    // Cancel preceding streams
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build model empty placeholder
    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setChatMessages((prev) => [...prev, assistantPlaceholder]);

    // Build runtime settings directly from user configurations
    const runtimeSettings = { ...settings };

    // Build subject specific system prompt: prepends ASTU syllabus details
    let finalSystemPrompt = settings.systemInstruction || "";
    if (syllabus && currentSemester && currentSubject) {
      const semData = syllabus.CSE_Syllabus_ASTU[currentSemester];
      finalSystemPrompt = `System instructions:\nSyllabus Info - Semester: ${currentSemester.replace(/_/g, " ")}. focus: ${semData.focus}. Subject Name: ${currentSubject.name}. Subject Context: ${currentSubject.context || ""}.\n\nInstructions: ${finalSystemPrompt}`;
    }
    runtimeSettings.systemInstruction = finalSystemPrompt;

    await generateContentStream(
      runtimeSettings,
      updatedMessages,
      (chunk) => {
        setChatMessages((prev) => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          last.content += chunk;
          next[next.length - 1] = last;
          return next;
        });
      },
      () => {
        setIsGenerating(false);
        abortControllerRef.current = null;
      },
      (err) => {
        setIsGenerating(false);
        abortControllerRef.current = null;
        setChatError(err.message || "Failed to retrieve stream response.");
        
        // Append error warning to the assistant chat bubble
        setChatMessages((prev) => {
          const next = [...prev];
          const last = { ...next[next.length - 1] };
          last.content = `⚠️ API Error: ${err.message}. Please verify your API settings or local server connection.`;
          next[next.length - 1] = last;
          return next;
        });
      },
      controller.signal
    );
  };

  const handleStopChatGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Navigating back
  const handleBack = () => {
    if (view === "qa" || view === "materials") {
      setView("subject_landing");
      setChatMessages([]);
      setAttachments([]);
    } else if (view === "subject_landing") {
      setView("semester");
      setCurrentSubject(null);
    } else if (view === "semester") {
      setView("home");
      setCurrentSemester(null);
    }
  };

  // Active Subject Material
  const activeSemesterMaterial = (materials && currentSemester) ? materials.semesters[currentSemester] : null;
  const activeSubjectMaterial = (activeSemesterMaterial && currentSubject) ? activeSemesterMaterial.subjects?.[currentSubject.name] : null;

  // Render Splash Screen
  if (view === "splash") {
    return <SplashScreen onFinish={() => setView(hasConfig ? "home" : "introduction")} />;
  }

  // Render Introduction Screen (Welcome Configuration Setup)
  if (view === "introduction") {
    if (introStep === 1) {
      return (
        <div className="splash-container" style={{ overflowY: "auto", padding: "3rem 1.5rem" }}>
          <div className="splash-glow opacity-100" />
          <div style={{ zIndex: 10, width: "100%", maxWidth: "600px", margin: "auto", textAlign: "center" }}>
            <h1 style={{ fontSize: "2.75rem", fontFamily: "Outfit", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Gemma Study Companion
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", marginBottom: "2rem" }}>
              Your desktop syllabus assistant and materials guide
            </p>
            
            <div className="card" style={{ padding: "2rem", textAlign: "left", marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.5rem" }}>📖</div>
                <div>
                  <h3 style={{ color: "var(--text-primary)", fontSize: "1.05rem", fontWeight: 600 }}>Syllabus Database</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>Access the official ASTU CSE course structures, elective badges, and lab requirements.</p>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.5rem" }}>🎥</div>
                <div>
                  <h3 style={{ color: "var(--text-primary)", fontSize: "1.05rem", fontWeight: 600 }}>Curated Study Materials</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>Quickly browse course textbooks lists, NPTEL courseware, and search YouTube lectures.</p>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.5rem" }}>💬</div>
                <div>
                  <h3 style={{ color: "var(--text-primary)", fontSize: "1.05rem", fontWeight: 600 }}>Academic Chat Assistant</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>Interact with Gemini, OpenAI, Groq, Anthropic, Ollama or LM Studio models.</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ fontSize: "1.5rem" }}>📂</div>
                <div>
                  <h3 style={{ color: "var(--text-primary)", fontSize: "1.05rem", fontWeight: 600 }}>Document Analysis</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.25rem" }}>Attach text or code documents directly to prepend context to your study questions.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIntroStep(2)}
              className="btn-primary"
              style={{ fontSize: "1rem", padding: "0.75rem 2.5rem", borderRadius: "12px", width: "100%" }}
            >
              Get Started
            </button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="splash-container" style={{ overflowY: "auto", padding: "3rem 1.5rem" }}>
          <div className="splash-glow opacity-100" />
          <div style={{ zIndex: 10, width: "100%", maxWidth: "960px", margin: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <button
                className="btn-secondary"
                onClick={() => setIntroStep(1)}
                style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.8rem" }}
              >
                ← Back
              </button>
            </div>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "2.25rem", fontFamily: "Outfit", fontWeight: 700, color: "var(--text-primary)" }}>
                API Configuration
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginTop: "0.5rem" }}>
                Configure your Local offline engine or Cloud API credentials to power the study assistant.
              </p>
            </div>
            <div className="card" style={{ padding: "2rem" }}>
              <ConfigurationPanel
                settings={settings}
                onSave={(newSettings) => {
                  handleSaveSettings(newSettings);
                  setView("home");
                }}
                isIntroduction={true}
              />
            </div>
          </div>
        </div>
      );
    }
  }

  const isLocal = settings.provider?.startsWith("local");

  return (
    <div className="app-container">
      {/* Sidebar Layout */}
      <aside className="sidebar">
        <div className="sidebar-header" onClick={navigateHome} style={{ cursor: "pointer" }}>
          <div className="logo-circle">B</div>
          <div className="logo-info">
            <span className="logo-title">BVEC Study Hub</span>
            <span className="logo-subtitle">Semesters</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Semester list selection">
          {semestersList.map((sem) => (
            <div
              key={sem}
              className={`sidebar-link ${currentSemester === sem ? "active" : ""}`}
              onClick={() => selectSemester(sem)}
            >
              {formatTitle(sem)}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={() => setIsSettingsOpen(true)} style={{ width: "100%", justifyContent: "flex-start", gap: "0.5rem" }}>
            <Settings size={16} />
            Settings
          </button>
        </div>
      </aside>

      {/* Main content pane */}
      <main className="main-content">
        {jsonError && (
          <div style={{ margin: "2rem", padding: "1rem", borderRadius: "12px", border: "1px solid var(--danger)", background: "var(--danger-weak)", color: "var(--danger)" }}>
            <AlertTriangle size={18} style={{ marginRight: "6px", verticalAlign: "middle" }} />
            <span>{jsonError}</span>
          </div>
        )}

        {/* HOME VIEW: Semesters Grid */}
        {view === "home" && (
          <div className="page-wrapper">
            <header className="page-header" style={{ marginBottom: "2.5rem" }}>
              <h1 className="page-title">Gemma Study Companion 🤖</h1>
              <p className="page-subtitle" style={{ fontSize: "1.15rem", opacity: 0.8 }}>
                Choose a semester, then pick a subject.
              </p>
            </header>

            <div className="card">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "1.25rem", color: "var(--text-primary)" }}>
                Semesters
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {semestersList.map((sem) => {
                  const semData = syllabus?.CSE_Syllabus_ASTU[sem];
                  return (
                    <div
                      key={sem}
                      className="card card-hover"
                      onClick={() => selectSemester(sem)}
                      style={{ padding: "1.25rem" }}
                    >
                      <div className="card-title">{formatTitle(sem)}</div>
                      <div className="card-desc" style={{ fontSize: "0.82rem", marginTop: "0.25rem" }}>
                        {semData?.focus || "View subject structures."}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SEMESTER VIEW: Subjects List */}
        {view === "semester" && currentSemester && syllabus && (
          <div className="page-wrapper">
            <header className="page-header">
              <div className="back-link" onClick={handleBack}>
                <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                Home
              </div>
              <h1 className="page-title">{formatTitle(currentSemester)}</h1>
              <p className="page-subtitle">
                {syllabus.CSE_Syllabus_ASTU[currentSemester].focus}
              </p>
            </header>

            <div className="card">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 500, marginBottom: "1.25rem", color: "var(--text-primary)" }}>
                Subjects
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {syllabus.CSE_Syllabus_ASTU[currentSemester].subjects.map((sub) => (
                  <div
                    key={sub.name}
                    className="card card-hover"
                    onClick={() => selectSubject(sub)}
                    style={{ padding: "1.25rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                      <div style={{ flex: 1 }}>
                        <div className="card-title">{sub.name}</div>
                        {sub.context && <div className="card-desc" style={{ fontSize: "0.85rem" }}>{sub.context}</div>}
                      </div>
                      <div className="badge-container" style={{ alignSelf: "flex-start", display: "flex", gap: "0.3rem" }}>
                        {sub.course_code && <span className="badge">{sub.course_code}</span>}
                        {sub.is_elective && <span className="badge badge-elective">Elective</span>}
                        {sub.system_track && <span className="badge badge-track">System Track</span>}
                        {sub.lab_component && <span className="badge badge-lab">Lab</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUBJECT LANDING VIEW: Materials vs Q&A */}
        {view === "subject_landing" && currentSubject && (
          <div className="page-wrapper">
            <header className="page-header">
              <div className="back-link" onClick={handleBack}>
                <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                {formatTitle(currentSemester)}
              </div>
              <h1 className="page-title">{currentSubject.name}</h1>
              <p className="page-subtitle">Choose a section.</p>
            </header>

            <div className="subject-options-grid">
              <div className="card card-hover" onClick={() => setView("materials")}>
                <div className="card-title">Materials</div>
                <div className="card-desc">
                  Books, YouTube lectures, NPTEL videos and other digital resources to study this subject.
                </div>
              </div>

              <div className="card card-hover" onClick={() => setView("qa")}>
                <div className="card-title">Subject Q&amp;A</div>
                <div className="card-desc">
                  Ask questions related to this subject and get immediate answers from an LLM based on Gemma.
                  <span style={{ display: "block", color: "var(--primary)", marginTop: "0.5rem", fontSize: "0.8rem" }}>
                    Uses your configured API connection settings.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MATERIALS VIEW */}
        {view === "materials" && currentSubject && (
          <div className="page-wrapper">
            <header className="page-header">
              <div className="back-link" onClick={handleBack}>
                <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                {currentSubject.name}
              </div>
              <h1 className="page-title">Study Materials</h1>
              <p className="page-subtitle">
                {formatTitle(currentSemester)} • {currentSubject.name}
              </p>
            </header>

            <div className="material-info-section" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Course Reference code */}
              <div className="ref-box">
                <div className="ref-label">Course Reference / Syllabus Code</div>
                <div className="ref-value">
                  {currentSubject.course_code || activeSubjectMaterial?.course_code || "No code reference"}
                </div>
              </div>

              {/* Syllabus PDF & Slide Links Grid */}
              <div className="material-links-grid">
                <a
                  href={activeSubjectMaterial?.pdf || activeSemesterMaterial?.pdf || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="card card-hover"
                  style={{ padding: "1.25rem" }}
                >
                  <div className="card-title" style={{ fontSize: "1rem" }}>Subject Syllabus PDF</div>
                  <div className="card-desc" style={{ fontSize: "0.8rem" }}>
                    {activeSubjectMaterial?.pdf || activeSemesterMaterial?.pdf ? "View syllabus curriculum" : "Syllabus link unavailable"}
                  </div>
                </a>

                {activeSubjectMaterial?.nptel && (
                  <a
                    href={activeSubjectMaterial.nptel}
                    target="_blank"
                    rel="noreferrer"
                    className="card card-hover"
                    style={{ padding: "1.25rem" }}
                  >
                    <div className="card-title" style={{ fontSize: "1rem" }}>NPTEL Course</div>
                    <div className="card-desc" style={{ fontSize: "0.8rem" }}>Official NPTEL online courseware lectures.</div>
                  </a>
                )}

                {activeSubjectMaterial?.youtube && (
                  <a
                    href={activeSubjectMaterial.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="card card-hover"
                    style={{ padding: "1.25rem" }}
                  >
                    <div className="card-title" style={{ fontSize: "1rem" }}>YouTube Lectures</div>
                    <div className="card-desc" style={{ fontSize: "0.8rem" }}>Search playlists and lecture resources.</div>
                  </a>
                )}

                {activeSubjectMaterial?.interactive && (
                  <a
                    href={activeSubjectMaterial.interactive}
                    target="_blank"
                    rel="noreferrer"
                    className="card card-hover"
                    style={{ padding: "1.25rem" }}
                  >
                    <div className="card-title" style={{ fontSize: "1rem" }}>Interactive Platform</div>
                    <div className="card-desc" style={{ fontSize: "0.8rem" }}>Visual practice and algorithm execution simulator.</div>
                  </a>
                )}
              </div>

              {/* Recommended Books list */}
              {activeSubjectMaterial?.books && activeSubjectMaterial.books.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                    Recommended Books
                  </h3>
                  <div className="books-list">
                    {activeSubjectMaterial.books.map((book, idx) => (
                      <div key={idx} className="book-card">
                        {book}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Global search tools links */}
              {materials?.global_libraries?.ebook_search_engines && (
                <div style={{ marginTop: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                    Global Digital Libraries
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.5rem" }}>
                    {materials.global_libraries.ebook_search_engines.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="card card-hover"
                        style={{ padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <span style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>E-Book Search: {link}</span>
                        <ExternalLink size={14} className="text-secondary" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Q&A CHAT VIEW */}
        {view === "qa" && currentSubject && (
          <div className="page-wrapper" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            <header className="page-header" style={{ marginBottom: "1rem", flexShrink: 0 }}>
              <div className="back-link" onClick={handleBack}>
                <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                {currentSubject.name}
              </div>
              <h1 className="page-title">Subject Q&amp;A</h1>
              <p className="page-subtitle">
                {formatTitle(currentSemester)} • {currentSubject.name}
              </p>
            </header>

            {/* Subject Context Header Card */}
            <div className="card shrink-0" style={{ padding: "1rem 1.25rem", marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Context
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginTop: "0.25rem" }}>
                {currentSubject.context || "No context provided."}
              </div>
            </div>

            {/* Chat Dialog Pane */}
            <div className="qa-layout">
              {/* Messages container */}
              <div className="qa-messages-box">
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "4rem" }}>
                    Ask any question related to the syllabus of this subject.
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role === "model" ? "assistant" : msg.role}`}>
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        renderBlockMarkdown(msg.content)
                      )}
                    </div>
                  ))
                )}
                {isGenerating && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].content === "" && (
                  <div className="chat-bubble assistant">
                    <span className="inline-flex items-center gap-1" aria-label="Thinking">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 opacity-60 animate-pulse" style={{ animationDelay: "0ms" }}></span>
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 opacity-60 animate-pulse" style={{ animationDelay: "180ms" }}></span>
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 opacity-60 animate-pulse" style={{ animationDelay: "360ms" }}></span>
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Area */}
              <div className="qa-input-bar">
                {chatError && (
                  <div style={{ fontSize: "0.8rem", color: "var(--danger)", padding: "0 0.5rem" }}>
                    {chatError}
                  </div>
                )}

                {/* Document Attachments row */}
                {attachments.length > 0 && (
                  <div className="attachment-container">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="attachment-pill">
                        <span style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <button className="attachment-delete" onClick={() => removeAttachment(idx)}>
                          <XCircle size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active API Mode description line (replaces toggles & selects) */}
                <div className="qa-toggle-row">
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isLocal ? "#10b981" : "#3b82f6", // Green for local, Blue for cloud
                        display: "inline-block",
                      }}
                    />
                    Active API: <strong>
                      {settings.provider === "gemini" ? "Google Gemini" :
                       settings.provider === "openai" ? "OpenAI" :
                       settings.provider === "anthropic" ? "Anthropic Claude" :
                       settings.provider === "groq" ? "Groq" :
                       settings.provider === "local-ollama" ? "Local Ollama" :
                       settings.provider === "local-openai" ? "Local LLM (LM Studio)" :
                       "None"}
                    </strong>
                  </span>
                </div>

                {/* Text input row */}
                <div className="qa-input-row">
                  {/* File attach button */}
                  <button
                    type="button"
                    className="qa-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach text / code document"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleFileUpload}
                    multiple
                    accept=".txt,.md,.js,.jsx,.ts,.tsx,.json,.py,.rs,.c,.cpp,.h,.java,.html,.css,.csv"
                  />

                  {/* Input textarea */}
                  <textarea
                    ref={chatInputRef}
                    className="qa-textarea"
                    rows={1}
                    placeholder="Ask a syllabus or subject question..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const val = e.currentTarget.value;
                        if (val.trim() || attachments.length > 0) {
                          handleSendChatMessage(val);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />

                  {/* Send / Stop button */}
                  {isGenerating ? (
                    <button
                      type="button"
                      className="qa-send-btn"
                      onClick={handleStopChatGeneration}
                      style={{ backgroundColor: "var(--danger)" }}
                      title="Stop generation"
                    >
                      <XCircle size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="qa-send-btn"
                      onClick={() => {
                        if (chatInputRef.current) {
                          const val = chatInputRef.current.value;
                          if (val.trim() || attachments.length > 0) {
                            handleSendChatMessage(val);
                            chatInputRef.current.value = "";
                          }
                        }
                      }}
                      title="Send message"
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Panel Modal popup */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
