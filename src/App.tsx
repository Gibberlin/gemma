import { useState, useEffect, useRef } from "react";
import {
  Settings,
  Paperclip,
  Send,
  ExternalLink,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Notebook,
  Plus,
  Trash2,
  Search,
  Save,
  Cloud,
  Database,
  UploadCloud,
  Sparkles,
  User,
  LogOut
} from "lucide-react";
import {
  Message,
  GenerationSettings,
  generateContentStream,
} from "./api";
import SettingsModal from "./components/SettingsModal";
import ConfigurationPanel from "./components/ConfigurationPanel";
import LoginScreen from "./components/LoginScreen";
import NoteFormModal from "./components/NoteFormModal";
import AdBanner from "./components/AdBanner";
import { onAuthChanged, signOutUser, isFirebaseConfigured } from "./firebase";
import {
  Note,
  SavedChat,
  getNotes,
  saveNote,
  deleteNote,
  createNote,
  getSavedChats,
  saveChat,
  deleteSavedChat,
  createSavedChat
} from "./utils/notesStorage";
import {
  CHAT_COMMANDS,
  parseMessageCommand,
  getModifiedSystemInstruction
} from "./utils/chatCommands";
import { marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";
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
    "You are a helpful, precise academic assistant aligned with the official ASTU CSE syllabus. Address the user's questions clearly, showing code snippets where appropriate, and cite the syllabus where relevant. IMPORTANT: For ALL mathematical formulas, equations, or scientific expressions, you MUST use standard LaTeX notation. Wrap display/block equations in double dollar signs ($$...$$) and inline expressions in single dollar signs ($...$). Do not use raw unicode or escaped text characters for formulas; write them in clean LaTeX so they can be rendered correctly by KaTeX.",
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
          <h1 className="splash-title">Senku</h1>
          <p className="splash-subtitle">Study Companion</p>
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
  const [view, setView] = useState<"splash" | "introduction" | "home" | "semester" | "subject_landing" | "materials" | "qa" | "my_notes">("splash");
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
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
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

  // --- Authentication State ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- My Note Workspace States ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [activeNotesSection, setActiveNotesSection] = useState<"notes" | "chats">("notes");
  const [notesSearchQuery, setNotesSearchQuery] = useState("");
  const [chatsSearchQuery, setChatsSearchQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [notesSubjectFilter, setNotesSubjectFilter] = useState("");
  const saveTimeoutRef = useRef<any>(null);

  // --- Quick Notes States ---
  const [quickNotes, setQuickNotes] = useState<Array<{ id: string; text?: string; image?: string; createdAt: number }>>([]);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [pastedImageSrc, setPastedImageSrc] = useState<string | null>(null);

  // --- Notes Form Modal States ---
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isFormModalUpload, setIsFormModalUpload] = useState(false);
  const [formModalPrefill, setFormModalPrefill] = useState<any>({});
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  // --- Chat dropdown / Autocomplete & commands States ---
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);
  const [chatInputText, setChatInputText] = useState("");
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [activeSavedChatId, setActiveSavedChatId] = useState<string | null>(null);

  // Load static files, notes and configurations on mount
  useEffect(() => {
    // Define global copy helper on window for markdown code blocks
    (window as any).copySenkuCode = (btn: HTMLButtonElement, containerId: string) => {
      const container = document.getElementById(containerId);
      const codeEl = container?.querySelector("code");
      if (codeEl) {
        const text = codeEl.innerText;
        navigator.clipboard.writeText(text).then(() => {
          const span = btn.querySelector("span");
          if (span) {
            span.innerText = "Copied!";
            span.style.color = "#34d399";
            setTimeout(() => {
              span.innerText = "Copy";
              span.style.color = "";
            }, 2000);
          }
        });
      }
    };

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
        
        // Force system instruction update if it does not mention LaTeX
        if (!merged.systemInstruction || !merged.systemInstruction.includes("LaTeX")) {
          merged.systemInstruction = DEFAULT_SETTINGS.systemInstruction;
          localStorage.setItem("gemma_settings", JSON.stringify(merged));
        }

        setSettings(merged);
        const configured = !!merged.provider && (merged.provider.startsWith("local") ? !!merged.customEndpoint : !!merged.apiKey);
        setHasConfig(configured);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }

    loadStaticData();

    // Hook up Firebase Auth Listener
    const unsubscribeAuth = onAuthChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    // Populate notes and saved chats
    setNotes(getNotes());
    setSavedChats(getSavedChats());

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Update lists when selectedNoteId or view transitions happen
  useEffect(() => {
    setNotes(getNotes());
    setSavedChats(getSavedChats());
  }, [view, selectedNoteId]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isGenerating]);

  // Load Quick Notes when subject changes
  useEffect(() => {
    if (currentSubject) {
      const saved = localStorage.getItem(`senku_quick_notes_${currentSubject.course_code || currentSubject.name}`);
      if (saved) {
        try {
          setQuickNotes(JSON.parse(saved));
        } catch (e) {
          setQuickNotes([]);
        }
      } else {
        setQuickNotes([]);
      }
    }
  }, [currentSubject]);

  // Save quick notes when changed
  useEffect(() => {
    if (currentSubject) {
      localStorage.setItem(
        `senku_quick_notes_${currentSubject.course_code || currentSubject.name}`,
        JSON.stringify(quickNotes)
      );
    }
  }, [quickNotes, currentSubject]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          // Max dimension 800px to maintain crispness but minimize storage sizes
          const maxDim = 800;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality (~25KB typical output)
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleQuickNotePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        
        try {
          const compressedUrl = await compressImage(file);
          setPastedImageSrc(compressedUrl);
        } catch (err) {
          console.error("Failed to compress pasted image:", err);
        }
        break; // Process one image at a time
      }
    }
  };

  const handleAddQuickNote = () => {
    if (!quickNoteText.trim() && !pastedImageSrc) return;
    const newQuickNote = {
      id: `qn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: quickNoteText.trim() || undefined,
      image: pastedImageSrc || undefined,
      createdAt: Date.now()
    };
    setQuickNotes(prev => [newQuickNote, ...prev]);
    setQuickNoteText("");
    setPastedImageSrc(null);
  };

  const handleDeleteQuickNote = (id: string) => {
    setQuickNotes(prev => prev.filter(qn => qn.id !== id));
  };

  const handleClearQuickNotes = () => {
    if (confirm("Are you sure you want to clear all quick notes for this subject?")) {
      setQuickNotes([]);
    }
  };

  const handleOpenQuickNoteImage = (dataUrl: string) => {
    const win = window.open();
    win?.document.write(`
      <html>
        <head><title>Quick Note Image Preview</title></head>
        <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111827;height:100vh;">
          <img src="${dataUrl}" style="max-width:95%;max-height:95%;box-shadow:0 10px 25px rgba(0,0,0,0.55);border-radius:8px;border:1px solid rgba(255,255,255,0.1);" />
        </body>
      </html>
    `);
  };

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


  // Configure custom marked renderer to wrap code blocks with copy buttons
  const renderer = new marked.Renderer();
  renderer.code = function({ text, lang }) {
    const language = lang || "code";
    const blockId = `code-block-${Math.random().toString(36).substring(2, 9)}`;
    
    return `
      <div class="code-block-container" id="${blockId}">
        <div class="code-block-header">
          <span>${language.toUpperCase()}</span>
          <button onclick="window.copySenkuCode(this, '${blockId}')" class="copy-btn">
            <span>Copy</span>
          </button>
        </div>
        <pre class="code-block-content"><code class="language-${language}">${text}</code></pre>
      </div>
    `;
  };
  marked.use({ renderer });

  // Unified LaTeX and Markdown rendering pipeline
  const renderMarkdownAndMath = (text: string): string => {
    if (!text) return "";

    const placeholders: string[] = [];
    let mathCounter = 0;

    // Helper to store math and return placeholder id
    const addPlaceholder = (mathText: string, displayMode: boolean) => {
      try {
        const html = katex.renderToString(mathText, {
          displayMode,
          throwOnError: false,
          trust: true,
        });
        const id = `MATHPLACEHOLDERXYZ${mathCounter++}`;
        placeholders.push(html);
        return id;
      } catch (e) {
        console.error("KaTeX rendering error", e);
        return mathText;
      }
    };

    // 1. Process display math blocks: $$...$$ or \[...\]
    let processed = text.replace(/\$\$\s*([\s\S]+?)\s*\$\$/g, (_, math) => {
      return addPlaceholder(math, true);
    });

    processed = processed.replace(/\\\[\s*([\s\S]+?)\s*\\\]/g, (_, math) => {
      return addPlaceholder(math, true);
    });

    // 2. Process inline math blocks: \(...\) or $...$
    processed = processed.replace(/\\\(\s*([\s\S]+?)\s*\\\)/g, (_, math) => {
      return addPlaceholder(math, false);
    });

    processed = processed.replace(/\$([^$\n]+?)\$/g, (_, math) => {
      // Avoid treating simple numbers as currency: e.g. $10 or $2.50
      if (/^\d+(\.\d+)?$/.test(math)) {
        return `$${math}$`;
      }
      return addPlaceholder(math, false);
    });

    // 3. Process markdown with marked
    let html = "";
    try {
      html = marked.parse(processed) as string;
    } catch (e) {
      console.error("Marked parsing error", e);
      html = processed;
    }

    // 4. Restore math placeholders
    for (let i = 0; i < placeholders.length; i++) {
      const id = `MATHPLACEHOLDERXYZ${i}`;
      html = html.split(id).join(placeholders[i]);
    }

    return html;
  };

  // --- Slash Command & Autocomplete handlers ---
  const handleTextChange = (text: string) => {
    setChatInputText(text);
    if (text.startsWith("/")) {
      const spaceIndex = text.indexOf(" ");
      // Open slash menu if they typed / and haven't typed a space yet
      if (spaceIndex === -1) {
        setIsSlashMenuOpen(true);
        return;
      }
    }
    setIsSlashMenuOpen(false);
  };

  const handleSelectSlashCommand = (cmd: string) => {
    setChatInputText(cmd + " ");
    setIsSlashMenuOpen(false);
    chatInputRef.current?.focus();
  };

  // --- Attach Note Handler ---
  const handleAttachNote = (note: Note) => {
    if (attachments.some((att) => att.name === `Note: ${note.title}`)) {
      alert("Note is already attached!");
      return;
    }
    setAttachments((prev) => [
      ...prev,
      {
        name: `Note: ${note.title}`,
        content: note.content,
        size: new Blob([note.content]).size,
      },
    ]);
  };

  // --- Note File Upload parser ---
  const handleNoteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (arrayBuffer !== undefined) {
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryData = Array.from(uint8Array);
        
        let filePath = "";
        try {
          if ((window as any).__TAURI_INTERNALS__) {
            const { invoke } = await import("@tauri-apps/api/core");
            filePath = await invoke("save_document_file", { name: file.name, data: binaryData });
          } else {
            // Browser demo mode fallback: save a data URL (limited size but works for mock testing)
            if (file.size > 500 * 1024) {
              filePath = `[Local File: ${file.name} (${Math.round(file.size / 1024)} KB) - File too large for browser storage. Use desktop app to open natively.]`;
            } else {
              filePath = `data:${file.type || "application/octet-stream"};base64,${btoa(
                binaryData.reduce((data, byte) => data + String.fromCharCode(byte), "")
              )}`;
            }
          }
        } catch (err) {
          console.error("Failed to save document:", err);
          filePath = `[Error saving local file: ${file.name}]`;
        }

        // Set form modal prefill with document metadata
        setFormModalPrefill({
          title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
          content: filePath,
          filePath: filePath,
          isDocument: true,
        });
        setIsFormModalUpload(true);
        setIsFormModalOpen(true);
      }
    };
    reader.readAsArrayBuffer(file);
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
  };

  // --- Note and Chat State Management wrappers ---
  const handleCreateOrUploadNoteConfirm = (data: {
    title: string;
    semester: string;
    subjectCode: string;
    subjectName: string;
    format: string;
    content?: string;
    filePath?: string;
    isDocument?: boolean;
  }) => {
    const newNote = createNote({
      title: data.title,
      content: data.content || "",
      semester: data.semester,
      subjectCode: data.subjectCode,
      subjectName: data.subjectName,
      format: data.format,
      filePath: data.filePath,
      isDocument: data.isDocument,
    });
    setNotes(getNotes());
    setSelectedNoteId(newNote.id);
    setIsFormModalOpen(false);
    setView("my_notes");
  };

  const handleDeleteNoteState = (id: string) => {
    deleteNote(id);
    setNotes(getNotes());
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  const handleDeleteSavedChatState = (id: string) => {
    deleteSavedChat(id);
    setSavedChats(getSavedChats());
    if (activeSavedChatId === id) setActiveSavedChatId(null);
  };

  const handleUpdateNoteTitle = (newTitle: string) => {
    if (!selectedNoteId) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === selectedNoteId ? { ...n, title: newTitle } : n))
    );
    const notesList = getNotes();
    const current = notesList.find((n) => n.id === selectedNoteId);
    if (current) {
      current.title = newTitle;
      saveNote(current);
    }
  };

  const handleUpdateNoteContent = (newContent: string) => {
    if (!selectedNoteId) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === selectedNoteId ? { ...n, content: newContent } : n))
    );
    setSaveStatus("Saving...");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const notesList = getNotes();
      const current = notesList.find((n) => n.id === selectedNoteId);
      if (current) {
        current.content = newContent;
        saveNote(current);
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(null), 2000);
      }
    }, 500);
  };

  // --- Saved Chat Actions ---
  const handleSaveCurrentChat = () => {
    if (chatMessages.length === 0 || !currentSubject) return;

    if (activeSavedChatId) {
      const savedList = getSavedChats();
      const current = savedList.find(c => c.id === activeSavedChatId);
      if (current) {
        current.messages = chatMessages;
        saveChat(current);
        setSavedChats(getSavedChats());
        alert("Chat progress updated successfully!");
        return;
      }
    }

    const titlePrompt = prompt(
      "Enter a title for this saved chat:",
      `${currentSubject.name} Chat - ${new Date().toLocaleDateString()}`
    );
    if (titlePrompt === null) return;
    const title = titlePrompt.trim() || `${currentSubject.name} Chat`;

    const newSavedChat = createSavedChat(
      title,
      chatMessages,
      currentSemester || undefined,
      currentSubject.course_code || undefined,
      currentSubject.name
    );
    setActiveSavedChatId(newSavedChat.id);
    setSavedChats(getSavedChats());
    alert("Chat saved successfully! You can access it in the 'My Note' section.");
  };

  const handleOpenSavedChat = (savedChat: SavedChat) => {
    setCurrentSemester(savedChat.semester || null);
    if (syllabus && savedChat.semester && savedChat.subjectName) {
      const semData = syllabus.CSE_Syllabus_ASTU[savedChat.semester];
      if (semData) {
        const foundSub = semData.subjects.find((s) => s.name === savedChat.subjectName);
        if (foundSub) {
          setCurrentSubject(foundSub);
        }
      }
    } else {
      setCurrentSubject({
        name: savedChat.subjectName || "Saved Chat Subject",
        course_code: savedChat.subjectCode,
      });
    }
    setChatMessages(savedChat.messages);
    setActiveSavedChatId(savedChat.id);
    setView("qa");
  };

  // Send Chat message handling with Slash commands
  const handleSendChatMessage = async (inputText: string) => {
    if (!inputText.trim() && attachments.length === 0) return;

    // 1. Parse Slash Command
    const { command, cleanText } = parseMessageCommand(inputText);

    let compiledContent = "";
    
    // If files are attached, parse and inject them inside code blocks
    if (attachments.length > 0) {
      compiledContent += "Here are the contents of the attached documents for context:\n\n";
      attachments.forEach((file) => {
        compiledContent += `[File: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      });
      compiledContent += "User's request:\n";
    }

    compiledContent += cleanText;

    // Reset inputs & attachments
    setAttachments([]);
    setChatInputText("");

    // Build the user message to display. Show the full command prompt so user knows what command they ran.
    const userMsg: Message = { role: "user", content: inputText };
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

    // Build base system prompt prepending ASTU syllabus details
    let finalSystemPrompt = settings.systemInstruction || "";
    if (syllabus && currentSemester && currentSubject) {
      const semData = syllabus.CSE_Syllabus_ASTU[currentSemester];
      finalSystemPrompt = `System instructions:\nSyllabus Info - Semester: ${currentSemester.replace(/_/g, " ")}. focus: ${semData.focus}. Subject Name: ${currentSubject.name}. Subject Context: ${currentSubject.context || ""}.\n\nInstructions: ${finalSystemPrompt}`;
    }

    // Compile attached notes text if required by /note or /noteonly, or auto-detect notes for this subject
    let attachedNotesContent = "";
    const noteAttachments = attachments.filter((a) => a.name.startsWith("Note:"));
    if (noteAttachments.length > 0) {
      attachedNotesContent = noteAttachments
        .map((a) => `[Note: ${a.name.substring(6)}]\n${a.content}`)
        .join("\n\n");
    } else if (currentSubject) {
      // Auto-extract notes matching this subject in localStorage
      const subjectNotes = getNotes().filter((n) => n.subjectName === currentSubject.name);
      if (subjectNotes.length > 0) {
        attachedNotesContent = subjectNotes
          .map((n) => `[Note: ${n.title}]\n${n.content}`)
          .join("\n\n");
      }
    }

    // Apply modified system prompt based on slash command
    runtimeSettings.systemInstruction = getModifiedSystemInstruction(
      command,
      finalSystemPrompt,
      attachedNotesContent
    );

    await generateContentStream(
      runtimeSettings,
      updatedMessages.map((m) => {
        // Strip the command trigger from the history sent to the model to avoid syntax confusion, if matched
        if (m.role === "user" && m.content.startsWith("/")) {
          const { cleanText: ct } = parseMessageCommand(m.content);
          return { ...m, content: ct };
        }
        return m;
      }),
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
      setActiveSavedChatId(null);
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
    return <SplashScreen onFinish={() => setView("home")} />;
  }

  // Auth Guard: Render Login Screen if not authenticated
  if (!currentUser && !authLoading) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setView("home");
        }}
      />
    );
  }

  // If firebase is in loading phase, show a minimal loading layout
  if (authLoading) {
    return (
      <div className="splash-container">
        <div className="splash-glow opacity-100" />
        <div className="splash-content">
          <div className="splash-title-wrap">
            <h1 className="splash-title">Senku</h1>
            <p className="splash-subtitle">Checking Authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render Introduction Screen (Welcome Configuration Setup)
  if (view === "introduction") {
    if (introStep === 1) {
      return (
        <div className="splash-container" style={{ overflowY: "auto", padding: "3rem 1.5rem" }}>
          <div className="splash-glow opacity-100" />
          <div style={{ zIndex: 10, width: "100%", maxWidth: "600px", margin: "auto", textAlign: "center" }}>
            <h1 style={{ fontSize: "2.75rem", fontFamily: "Outfit", fontWeight: 900, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Senku Study Companion
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", marginBottom: "2rem" }}>
              Your desktop syllabus assistant and science workspace
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
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        {/* Toggle Box / Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsSidebarCollapsed(!isSidebarCollapsed);
          }}
          className="sidebar-toggle-btn"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="sidebar-header" onClick={navigateHome} style={{ cursor: "pointer", justifyContent: isSidebarCollapsed ? "center" : "flex-start" }}>
          <div className="logo-circle" style={{ overflow: "hidden", background: "transparent", border: "none" }}>
            <img src="/logo.png" alt="Senku Study Companion Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "10px" }} />
          </div>
          {!isSidebarCollapsed && (
            <div className="logo-info">
              <span className="logo-title">Senku Study Companion</span>
              <span className="logo-subtitle">Semesters</span>
            </div>
          )}
        </div>
        
        <div className="sidebar-divider" style={{ margin: "0.5rem 1.25rem", height: "1px", background: "var(--divider)" }} />

        <div
          className={`sidebar-link ${view === "my_notes" ? "active" : ""}`}
          onClick={() => {
            setNotesSubjectFilter(""); // Clear filter
            setView("my_notes");
          }}
          style={{
            justifyContent: isSidebarCollapsed ? "center" : "flex-start",
            padding: isSidebarCollapsed ? "0.75rem 0" : "0.75rem 1rem",
            margin: "0 0.5rem 0.5rem 0.5rem",
          }}
          title={isSidebarCollapsed ? "My Note" : undefined}
        >
          <Notebook size={16} style={{ marginRight: isSidebarCollapsed ? 0 : "0.5rem" }} />
          {!isSidebarCollapsed && <span>My Note</span>}
        </div>

        <div className="sidebar-divider" style={{ margin: "0.5rem 1.25rem", height: "1px", background: "var(--divider)" }} />

        <nav className="sidebar-nav" aria-label="Semester list selection">
          {semestersList.map((sem) => (
            <div
              key={sem}
              className={`sidebar-link ${currentSemester === sem ? "active" : ""}`}
              onClick={() => selectSemester(sem)}
              style={{
                justifyContent: isSidebarCollapsed ? "center" : "flex-start",
                padding: isSidebarCollapsed ? "0.75rem 0" : "0.75rem 1rem",
              }}
              title={isSidebarCollapsed ? formatTitle(sem) : undefined}
            >
              {isSidebarCollapsed ? (
                <span className="sidebar-abbrev">
                  {sem === "Bridge_Courses" ? "BC" : sem.replace("Semester_", "S")}
                </span>
              ) : (
                <span>{formatTitle(sem)}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ padding: isSidebarCollapsed ? "0.75rem 0.5rem" : "1.25rem" }}>
          {currentUser && (
            <button
              className="sidebar-link"
              onClick={() => setIsAccountOpen(true)}
              style={{
                width: "100%",
                justifyContent: isSidebarCollapsed ? "center" : "flex-start",
                gap: "0.5rem",
                padding: isSidebarCollapsed ? "0.75rem 0" : "0.75rem 1rem",
                color: "var(--text-primary)",
              }}
              title={isSidebarCollapsed ? `Account Settings (${currentUser.displayName || currentUser.email?.split("@")[0] || 'User'})` : `Account Settings`}
            >
              <User size={16} style={{ color: "var(--primary)" }} />
              {!isSidebarCollapsed && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px", fontSize: "0.85rem" }}>
                  {currentUser.displayName || currentUser.email?.split("@")[0] || "User"}
                </span>
              )}
            </button>
          )}
          
          <button
            className="sidebar-link"
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: "100%",
              justifyContent: isSidebarCollapsed ? "center" : "flex-start",
              gap: "0.5rem",
              padding: isSidebarCollapsed ? "0.75rem 0" : "0.75rem 1rem",
            }}
            title={isSidebarCollapsed ? "Settings" : undefined}
          >
            <Settings size={16} />
            {!isSidebarCollapsed && <span>Settings</span>}
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
              <h1 className="page-title">Senku Study Companion 🧪</h1>
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

              <div className="card card-hover" onClick={() => { setChatMessages([]); setActiveSavedChatId(null); setView("qa"); }}>
                <div className="card-title">Subject Q&amp;A</div>
                <div className="card-desc">
                  Ask questions related to this subject and get immediate answers from Senku's AI assistant.
                  <span style={{ display: "block", color: "var(--primary)", marginTop: "0.5rem", fontSize: "0.8rem" }}>
                    Uses your configured API connection settings.
                  </span>
                </div>
              </div>

              <div className="card card-hover" onClick={() => { setNotesSubjectFilter(currentSubject.name); setView("my_notes"); }}>
                <div className="card-title">Subject Notes</div>
                <div className="card-desc">
                  Read, edit and organize your personal notes and summaries for this subject.
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
              {/* Subject Notes Integration */}
              <div style={{ marginTop: "2rem", borderTop: "1px solid var(--divider)", paddingTop: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Notebook size={18} className="text-primary" />
                    <span>My Notes for this Subject</span>
                  </h3>
                  <button
                    className="action-btn-primary"
                    onClick={() => {
                      setFormModalPrefill({
                        semester: currentSemester || "",
                        subjectName: currentSubject.name,
                        subjectCode: currentSubject.course_code || "",
                      });
                      setIsFormModalUpload(false);
                      setIsFormModalOpen(true);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.4rem 0.8rem",
                      fontSize: "0.8rem",
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 500,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Note</span>
                  </button>
                </div>

                {notes.filter(n => n.subjectName === currentSubject.name).length === 0 ? (
                  <div className="ref-box" style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "1.5rem" }}>
                    No notes found for this subject. Click "Add Note" to create one.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
                    {notes
                      .filter(n => n.subjectName === currentSubject.name)
                      .map((note) => (
                        <div
                          key={note.id}
                          className="card card-hover"
                          onClick={() => {
                            // Open note in the Notes workspace
                            setSelectedNoteId(note.id);
                            setNotesSubjectFilter(currentSubject.name);
                            setView("my_notes");
                          }}
                          style={{ padding: "1rem", position: "relative", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.25rem" }}>
                            <span className="badge" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>{note.format || "Other"}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {note.title}
                          </h4>
                          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.25rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {note.content || "Empty note."}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

               {view === "qa" && currentSubject && (
          <div className="page-wrapper" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            <header className="page-header" style={{ marginBottom: "1rem", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div className="back-link" onClick={handleBack}>
                  <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                  {currentSubject.name}
                </div>
                <h1 className="page-title">Subject Q&amp;A</h1>
                <p className="page-subtitle">
                  {formatTitle(currentSemester)} • {currentSubject.name}
                </p>
              </div>

              {chatMessages.length > 0 && (
                <button
                  onClick={handleSaveCurrentChat}
                  className="action-btn-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.5rem 1rem",
                    background: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: 500,
                    boxShadow: "var(--shadow-sm)",
                    marginBottom: "0.5rem",
                  }}
                >
                  <Save size={14} />
                  <span>Save Chat</span>
                </button>
              )}
            </header>

            {!hasConfig && (
              <div className="login-warning-box shrink-0" style={{ margin: "0 0 0.75rem 0", padding: "0.75rem 1rem", borderRadius: "12px", background: "rgba(249, 115, 22, 0.08)", border: "1px solid rgba(249, 115, 22, 0.3)", color: "#ea580c", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <AlertTriangle size={16} className="warning-icon" style={{ color: "#ea580c", flexShrink: 0 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div className="warning-title" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#c2410c" }}>API Connection Not Configured</div>
                    <div className="warning-desc" style={{ fontSize: "0.75rem", marginTop: "0.15rem", color: "#ea580c" }}>
                      To converse with the model, please setup a Local server or Cloud API in configuration.
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="action-btn-primary" 
                    style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", borderRadius: "6px", background: "#ea580c", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Configure Settings
                  </button>
                </div>
              </div>
            )}

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
            <div className="qa-layout" style={{ display: "flex", flexDirection: "row", height: "calc(100vh - 12rem)", minHeight: "450px", overflow: "hidden" }}>
              {/* Chat Panel */}
              <div className="qa-chat-pane" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", borderRight: "1px solid var(--divider)" }}>
                {/* Messages container */}
                <div className="qa-messages-box">
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "4rem" }}>
                    Ask any question related to the syllabus of this subject. Try typing <strong style={{ color: "var(--primary)" }}>/</strong> for special commands.
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => {
                    const isCommandMsg = msg.role === "user" && msg.content.startsWith("/");
                    let displayContent = msg.content;
                    let activeCmdName = "";

                    if (isCommandMsg) {
                      const spaceIdx = msg.content.indexOf(" ");
                      const trigger = spaceIdx === -1 ? msg.content : msg.content.substring(0, spaceIdx);
                      const matchedCmd = CHAT_COMMANDS.find(c => c.trigger === trigger);
                      if (matchedCmd) {
                        activeCmdName = matchedCmd.name;
                        displayContent = spaceIdx === -1 ? "" : msg.content.substring(spaceIdx + 1);
                      }
                    }

                    return (
                      <div key={idx} className={`chat-bubble ${msg.role === "model" ? "assistant" : msg.role}`}>
                        {msg.role === "user" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                            {activeCmdName && (
                              <span className="chat-command-badge">
                                {activeCmdName}
                              </span>
                            )}
                            <span>{displayContent}</span>
                          </div>
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: renderMarkdownAndMath(msg.content) }} style={{ width: "100%" }} />
                        )}
                      </div>
                    );
                  })
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

                {/* Floating Autocomplete Slash Commands Menu */}
                {isSlashMenuOpen && (
                  <div className="slash-commands-menu">
                    <div className="slash-commands-header">Chat Skills &amp; Commands</div>
                    {CHAT_COMMANDS.map((cmd) => (
                      <div
                        key={cmd.trigger}
                        className="slash-command-item"
                        onClick={() => handleSelectSlashCommand(cmd.trigger)}
                      >
                        <span className="command-trigger">{cmd.trigger}</span>
                        <span className="command-desc">{cmd.description}</span>
                      </div>
                    ))}
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

                {/* Active API Mode description line */}
                <div className="qa-toggle-row">
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isLocal ? "#10b981" : "#3b82f6",
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
                <div className="qa-input-row" style={{ position: "relative" }}>
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

                  {/* Note attach button */}
                  <button
                    type="button"
                    className="qa-attach-btn"
                    onClick={() => setIsNoteDropdownOpen(!isNoteDropdownOpen)}
                    title="Attach a saved note"
                    style={{ color: isNoteDropdownOpen ? "var(--primary)" : "inherit" }}
                  >
                    <Notebook size={18} />
                  </button>

                  {/* Notes attach dropdown */}
                  {isNoteDropdownOpen && (
                    <div className="notes-attach-dropdown">
                      <div className="notes-attach-dropdown-header">Select a note to attach:</div>
                      <div className="notes-attach-dropdown-list">
                        {notes.length === 0 ? (
                          <div className="notes-attach-dropdown-empty">No notes found. Create notes in the **My Note** section.</div>
                        ) : (
                          notes.map((note) => (
                            <div
                              key={note.id}
                              className="notes-attach-dropdown-item"
                              onClick={() => {
                                handleAttachNote(note);
                                setIsNoteDropdownOpen(false);
                              }}
                            >
                              <div className="note-item-title">{note.title}</div>
                              <div className="note-item-meta">{note.subjectName || "General"} • {note.format || "Note"}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Input textarea */}
                  <textarea
                    ref={chatInputRef}
                    className="qa-textarea"
                    rows={1}
                    placeholder="Ask a syllabus question... (use / for skills)"
                    value={chatInputText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (chatInputText.trim() || attachments.length > 0) {
                          handleSendChatMessage(chatInputText);
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
                        if (chatInputText.trim() || attachments.length > 0) {
                          handleSendChatMessage(chatInputText);
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

            {/* Quick Notes Side-Panel */}
              <div className="qa-notes-pane" style={{ width: "360px", display: "flex", flexDirection: "column", height: "100%", background: "rgba(255,255,255,0.015)", overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--divider)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.03)", flexShrink: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>
                    <Notebook size={14} />
                    <span>Subject Quick Notes</span>
                  </span>
                  {quickNotes.length > 0 && (
                    <button 
                      onClick={handleClearQuickNotes}
                      style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", padding: "0.25rem", borderRadius: "4px" }}
                      title="Clear all quick notes"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Paste & Input Area */}
                <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--divider)", display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
                  <textarea
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    onPaste={handleQuickNotePaste}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddQuickNote();
                      }
                    }}
                    placeholder="Type note or paste image (Ctrl+V) from clipboard here..."
                    style={{
                      width: "100%",
                      minHeight: "70px",
                      maxHeight: "100px",
                      padding: "0.5rem 0.6rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--divider)",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      outline: "none",
                      color: "var(--text-primary)",
                      resize: "none"
                    }}
                  />
                  {pastedImageSrc && (
                    <div style={{ position: "relative", display: "inline-block", marginTop: "0.25rem", alignSelf: "flex-start" }}>
                      <img src={pastedImageSrc} alt="Pasted preview" style={{ maxHeight: "80px", borderRadius: "6px", border: "1px solid var(--divider)" }} />
                      <button 
                        onClick={() => setPastedImageSrc(null)}
                        style={{ position: "absolute", top: "-5px", right: "-5px", background: "var(--danger)", color: "white", border: "none", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Supports image clipboard paste</span>
                    <button 
                      onClick={handleAddQuickNote}
                      className="action-btn-primary" 
                      style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem", borderRadius: "4px", background: "var(--primary)", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Add Note
                    </button>
                  </div>
                </div>

                {/* Notes List */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {quickNotes.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "3rem", padding: "0 1rem", lineHeight: 1.5 }}>
                      No quick notes for this subject yet.<br/>Type here or paste screenshots directly into the box!
                    </div>
                  ) : (
                    quickNotes.map((qn) => (
                      <div key={qn.id} className="card" style={{ padding: "0.6rem 0.75rem", position: "relative", display: "flex", flexDirection: "column", gap: "0.3rem", border: "1px solid var(--divider)", borderRadius: "8px", background: "rgba(255,255,255,0.01)" }}>
                        <button
                          onClick={() => handleDeleteQuickNote(qn.id)}
                          style={{ position: "absolute", top: "0.4rem", right: "0.4rem", opacity: 0.6, background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                          title="Delete snippet"
                        >
                          <XCircle size={11} />
                        </button>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                          {new Date(qn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {qn.text && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: "1.2rem", lineHeight: 1.4 }}>
                            {qn.text}
                          </div>
                        )}
                        {qn.image && (
                          <div 
                            style={{ marginTop: "0.25rem", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--divider)", cursor: "pointer" }} 
                            onClick={() => qn.image && handleOpenQuickNoteImage(qn.image)}
                            title="Click to view image in full size"
                          >
                            <img 
                              src={qn.image} 
                              alt="Quick note content" 
                              style={{ width: "100%", maxHeight: "150px", objectFit: "contain", background: "var(--bg-primary)" }}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MY NOTES VIEW: Document Editor & Chat History List */}
        {view === "my_notes" && (
          <div className="page-wrapper" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 2rem)" }}>
            <header className="page-header" style={{ marginBottom: "1.5rem", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="back-link" onClick={() => {
                  if (notesSubjectFilter && currentSubject) {
                    setView("subject_landing");
                  } else {
                    navigateHome();
                  }
                }}>
                  <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                  {notesSubjectFilter ? `Back to ${notesSubjectFilter}` : "Back to Home"}
                </div>
                <h1 className="page-title">My Note</h1>
                <p className="page-subtitle">Manage study notes, teacher materials, and saved chat threads.</p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {notesSubjectFilter && (
                  <button
                    onClick={() => setNotesSubjectFilter("")}
                    className="btn-secondary"
                    style={{
                      padding: "0.4rem 0.8rem",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 500
                    }}
                  >
                    Clear Filter
                  </button>
                )}
                
                {/* Upload note file */}
                <input
                  type="file"
                  ref={uploadFileInputRef}
                  style={{ display: "none" }}
                  onChange={handleNoteFileUpload}
                  accept=".txt,.md,.json,.js,.py,.rs,.c,.cpp,.java,.html,.css"
                />
                <button
                  onClick={() => uploadFileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 500
                  }}
                >
                  <UploadCloud size={14} />
                  <span>Upload File</span>
                </button>
                
                <button
                  onClick={() => {
                    setFormModalPrefill({});
                    setIsFormModalUpload(false);
                    setIsFormModalOpen(true);
                  }}
                  className="btn-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    boxShadow: "var(--shadow-sm)"
                  }}
                >
                  <Plus size={14} />
                  <span>New Note</span>
                </button>
              </div>
            </header>

            {/* Switcher Tabs */}
            <div className="notes-section-tabs" style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--divider)", marginBottom: "1rem", paddingBottom: "0.25rem", flexShrink: 0 }}>
              <button
                className={`notes-tab-btn ${activeNotesSection === "notes" ? "active" : ""}`}
                onClick={() => setActiveNotesSection("notes")}
                style={{
                  padding: "0.5rem 1rem",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeNotesSection === "notes" ? "2px solid var(--primary)" : "2px solid transparent",
                  color: activeNotesSection === "notes" ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem"
                }}
              >
                Notes ({notes.filter(n => !notesSubjectFilter || n.subjectName === notesSubjectFilter).length})
              </button>
              <button
                className={`notes-tab-btn ${activeNotesSection === "chats" ? "active" : ""}`}
                onClick={() => setActiveNotesSection("chats")}
                style={{
                  padding: "0.5rem 1rem",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeNotesSection === "chats" ? "2px solid var(--primary)" : "2px solid transparent",
                  color: activeNotesSection === "chats" ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem"
                }}
              >
                Saved Chats ({savedChats.filter(c => !notesSubjectFilter || c.subjectName === notesSubjectFilter).length})
              </button>
            </div>

            {/* Split layout workspace */}
            <div className="notes-workspace-layout" style={{ display: "flex", flex: 1, overflow: "hidden", border: "1px solid var(--divider)", borderRadius: "16px", background: "var(--bg-surface)", backdropFilter: "blur(12px)" }}>
              {/* Left sidebar: items listing */}
              <div className="notes-list-pane" style={{ width: "320px", borderRight: "1px solid var(--divider)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
                {activeNotesSection === "notes" ? (
                  <>
                    <div className="notes-search-container" style={{ padding: "0.75rem", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Search size={16} className="text-secondary" />
                      <input
                        type="text"
                        placeholder="Search notes..."
                        value={notesSearchQuery}
                        onChange={(e) => setNotesSearchQuery(e.target.value)}
                        style={{ width: "100%", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.85rem" }}
                      />
                    </div>

                    <div className="notes-items-list" style={{ flex: 1, overflowY: "auto", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {notes
                        .filter(n => !notesSubjectFilter || n.subjectName === notesSubjectFilter)
                        .filter(n => !notesSearchQuery.trim() || n.title.toLowerCase().includes(notesSearchQuery.toLowerCase()) || n.content.toLowerCase().includes(notesSearchQuery.toLowerCase()))
                        .length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "2rem" }}>
                          No notes found.
                        </div>
                      ) : (
                        notes
                          .filter(n => !notesSubjectFilter || n.subjectName === notesSubjectFilter)
                          .filter(n => !notesSearchQuery.trim() || n.title.toLowerCase().includes(notesSearchQuery.toLowerCase()) || n.content.toLowerCase().includes(notesSearchQuery.toLowerCase()))
                          .map((note) => (
                            <div
                              key={note.id}
                              className={`note-list-item ${selectedNoteId === note.id ? "active" : ""}`}
                              onClick={() => setSelectedNoteId(note.id)}
                            >
                              <div className="note-item-header">
                                <span className="note-format-badge">{note.format || "Other"}</span>
                                <span className="note-date">{new Date(note.updatedAt).toLocaleDateString()}</span>
                              </div>
                              <div className="note-item-title">{note.title || "Untitled Note"}</div>
                              <div className="note-item-snippet">{note.content || "Empty content."}</div>
                              <div className="note-item-meta-row">
                                {note.subjectName && <span className="note-subject-tag">{note.subjectName}</span>}
                              </div>
                              <button
                                className="note-delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete note "${note.title}"?`)) {
                                    handleDeleteNoteState(note.id);
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="notes-search-container" style={{ padding: "0.75rem", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Search size={16} className="text-secondary" />
                      <input
                        type="text"
                        placeholder="Search saved chats..."
                        value={chatsSearchQuery}
                        onChange={(e) => setChatsSearchQuery(e.target.value)}
                        style={{ width: "100%", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: "0.85rem" }}
                      />
                    </div>

                    <div className="notes-items-list" style={{ flex: 1, overflowY: "auto", padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {savedChats
                        .filter(c => !notesSubjectFilter || c.subjectName === notesSubjectFilter)
                        .filter(c => !chatsSearchQuery.trim() || c.title.toLowerCase().includes(chatsSearchQuery.toLowerCase()))
                        .length === 0 ? (
                        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "2rem" }}>
                          No saved chats found.
                        </div>
                      ) : (
                        savedChats
                          .filter(c => !notesSubjectFilter || c.subjectName === notesSubjectFilter)
                          .filter(c => !chatsSearchQuery.trim() || c.title.toLowerCase().includes(chatsSearchQuery.toLowerCase()))
                          .map((chat) => (
                            <div
                              key={chat.id}
                              className="note-list-item saved-chat-list-item"
                              onClick={() => handleOpenSavedChat(chat)}
                            >
                              <div className="note-item-header">
                                <span className="note-format-badge chat-badge">Chat History</span>
                                <span className="note-date">{new Date(chat.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="note-item-title">{chat.title}</div>
                              <div className="note-item-snippet">
                                {chat.messages.length} messages. Last: {chat.messages[chat.messages.length - 1]?.content.substring(0, 50)}...
                              </div>
                              <div className="note-item-meta-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                                {chat.subjectName && <span className="note-subject-tag">{chat.subjectName}</span>}
                                <button
                                  className="note-delete-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete saved chat "${chat.title}"?`)) {
                                      handleDeleteSavedChatState(chat.id);
                                    }
                                  }}
                                  style={{ position: "static", opacity: 0.8 }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right panel: editor workspace */}
              <div className="notes-editor-pane" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {activeNotesSection === "notes" && selectedNoteId && notes.find(n => n.id === selectedNoteId) ? (() => {
                  const activeNote = notes.find(n => n.id === selectedNoteId)!;
                  return (
                    <div className="note-editor-container" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.25rem", overflow: "hidden" }}>
                      {/* Status header */}
                      <div className="editor-status-bar" style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "var(--text-secondary)", borderBottom: "1px solid var(--divider)", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
                        <div className="status-item local" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Database size={12} />
                          <span>Local Storage (Device Secured)</span>
                        </div>
                        <div className="status-item cloud" style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--accent-teal)" }}>
                          <Cloud size={12} />
                          <span>GCS Cloud Sync Ready</span>
                        </div>
                        {saveStatus && (
                          <span style={{ marginLeft: "auto", fontStyle: "italic", color: "var(--text-muted)" }}>
                            {saveStatus}
                          </span>
                        )}
                      </div>

                      {/* Title Edit Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem", gap: "1rem" }}>
                        <input
                          type="text"
                          value={activeNote.title}
                          onChange={(e) => handleUpdateNoteTitle(e.target.value)}
                          className="note-title-editor"
                          placeholder="Untitled Note"
                          style={{ flex: 1, border: "none", background: "transparent", color: "var(--text-primary)", fontSize: "1.5rem", fontWeight: 700, outline: "none" }}
                        />
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete the note "${activeNote.title}"?`)) {
                              handleDeleteNoteState(activeNote.id);
                            }
                          }}
                          className="action-btn-danger"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.4rem 0.8rem",
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            transition: "all 0.2s"
                          }}
                          title="Delete Note"
                        >
                          <Trash2 size={13} />
                          <span>Delete Note</span>
                        </button>
                      </div>

                      {/* Meta Tags Details */}
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                        {activeNote.semester && <span className="badge" style={{ fontSize: "0.7rem" }}>Semester: {activeNote.semester.replace(/_/g, " ")}</span>}
                        {activeNote.subjectName && <span className="badge" style={{ fontSize: "0.7rem" }}>Subject: {activeNote.subjectName}</span>}
                        {activeNote.format && <span className="badge badge-elective" style={{ fontSize: "0.7rem" }}>{activeNote.format}</span>}
                      </div>

                      {/* Tab modes */}
                      {!activeNote.isDocument && (
                        <div className="editor-tabs-row" style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--divider)", marginBottom: "0.75rem", paddingBottom: "0.25rem" }}>
                          <button
                            className={`editor-tab-btn ${editorMode === "write" ? "active" : ""}`}
                            onClick={() => setEditorMode("write")}
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              background: editorMode === "write" ? "var(--primary-weak)" : "transparent",
                              border: "none",
                              borderRadius: "6px",
                              color: editorMode === "write" ? "var(--primary)" : "var(--text-secondary)",
                              cursor: "pointer"
                            }}
                          >
                            Write (Markdown)
                          </button>
                          <button
                            className={`editor-tab-btn ${editorMode === "preview" ? "active" : ""}`}
                            onClick={() => setEditorMode("preview")}
                            style={{
                              padding: "0.3rem 0.6rem",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              background: editorMode === "preview" ? "var(--primary-weak)" : "transparent",
                              border: "none",
                              borderRadius: "6px",
                              color: editorMode === "preview" ? "var(--primary)" : "var(--text-secondary)",
                              cursor: "pointer"
                            }}
                          >
                            Preview Math &amp; Markdown
                          </button>
                        </div>
                      )}

                      {/* Workspace fields */}
                      <div className="editor-body-workspace" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                        {activeNote.isDocument ? (
                          <div className="document-detail-card" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem", background: "rgba(255, 255, 255, 0.4)", borderRadius: "16px", border: "1px solid var(--divider)", margin: "1rem 0" }}>
                            <div style={{ fontSize: "4.5rem", marginBottom: "1.25rem", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.06))" }}>
                              {activeNote.format === "Image files" ? "🖼️" : activeNote.format === "Presentation" ? "📊" : "📄"}
                            </div>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", textAlign: "center", marginBottom: "0.25rem" }}>
                              {activeNote.title}
                            </h3>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.75rem", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                              {activeNote.format || "Uploaded Document"}
                            </p>
                            
                            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--divider)", borderRadius: "10px", padding: "0.75rem 1rem", width: "100%", maxWidth: "480px", marginBottom: "2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "center" }}>
                              <strong>Location:</strong> {activeNote.filePath?.startsWith("data:") ? "In-Memory Browser Cache" : activeNote.filePath}
                            </div>
                            
                            <button
                              onClick={async () => {
                                const path = activeNote.filePath;
                                if (!path) return;
                                if (path.startsWith("data:")) {
                                  // Browser download / open in new tab
                                  const win = window.open();
                                  if (win) {
                                    win.document.write(`<iframe src="${path}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                  } else {
                                    // Fallback download
                                    const link = document.createElement("a");
                                    link.href = path;
                                    link.download = activeNote.title;
                                    link.click();
                                  }
                                } else {
                                  // Tauri native open
                                  try {
                                    const { invoke } = await import("@tauri-apps/api/core");
                                    await invoke("open_document_file", { path });
                                  } catch (err) {
                                    console.error("Failed to open document:", err);
                                    alert("Could not open file natively. Make sure the file exists at: " + path);
                                  }
                                }
                              }}
                              className="btn-primary"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.85rem 2rem",
                                fontSize: "0.95rem",
                                borderRadius: "12px",
                                cursor: "pointer",
                                border: "none",
                                background: "var(--primary)",
                                color: "white",
                                fontWeight: 600,
                                boxShadow: "var(--shadow-md)",
                              }}
                            >
                              <span>Open Document in Dedicated App</span>
                            </button>
                          </div>
                        ) : editorMode === "write" ? (
                          <textarea
                            value={activeNote.content}
                            onChange={(e) => handleUpdateNoteContent(e.target.value)}
                            className="note-body-textarea"
                            placeholder="Start typing your notes here. Supports Markdown formatting (**bold**, # Header) and LaTeX formulas ($E=mc^2$ or $$f(x)=x^2$$)."
                            style={{ width: "100%", flex: 1, border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", resize: "none", fontSize: "0.95rem", lineHeight: 1.6 }}
                          />
                        ) : (
                          <div
                            className="note-body-preview"
                            dangerouslySetInnerHTML={{ __html: renderMarkdownAndMath(activeNote.content) || "<p style='color:var(--text-muted);font-style:italic;'>Empty content. Type in Write tab to preview.</p>" }}
                            style={{ flex: 1, overflowY: "auto", fontSize: "0.95rem", lineHeight: 1.6 }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })() : activeNotesSection === "notes" ? (
                  <div className="notes-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "2rem", color: "var(--text-secondary)" }}>
                    <Notebook size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>No Note Selected</h3>
                    <p style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.25rem", textAlign: "center" }}>Select a note from the left panel, upload a document, or create a new one to begin editing.</p>
                  </div>
                ) : (
                  <div className="notes-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "2rem", color: "var(--text-secondary)" }}>
                    <Sparkles size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Saved Chat Histories</h3>
                    <p style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.25rem", textAlign: "center" }}>Select a saved conversation thread from the left list to restore the session and continue asking questions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {currentUser && <AdBanner />}
      </main>

      {/* Note Form Modal popup */}
      <NoteFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateOrUploadNoteConfirm}
        syllabus={syllabus}
        prefilledData={formModalPrefill}
        isUpload={isFormModalUpload}
      />

      {/* Settings Panel Modal popup */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Account Settings Modal popup */}
      {isAccountOpen && currentUser && (
        <div className="modal-overlay" style={{ display: "flex", zIndex: 2000, position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-content" style={{ maxWidth: "420px", width: "90%", padding: "1.75rem", borderRadius: "16px", background: "var(--bg-surface)", border: "1px solid var(--divider)", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>Account Settings</h3>
              <button 
                onClick={() => setIsAccountOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", border: "2px solid var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", fontSize: "1.75rem", fontWeight: 700 }}>
                {(currentUser.displayName || currentUser.email || "S")[0].toUpperCase()}
              </div>
              <div style={{ textAlign: "center" }}>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {currentUser.displayName || currentUser.email?.split("@")[0] || "Student"}
                </h4>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", opacity: 0.8 }}>
                  {currentUser.email}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.75rem" }}>
              {/* Username editing field */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)" }}>Username / Display Name</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input 
                    type="text" 
                    placeholder="Enter username"
                    defaultValue={currentUser.displayName || currentUser.email?.split("@")[0] || ""}
                    id="new-username-input"
                    className="note-title-editor"
                    style={{ flex: 1, padding: "0.45rem 0.75rem", background: "var(--bg-primary)", border: "1px solid var(--divider)", borderRadius: "8px", fontSize: "0.85rem", color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={async () => {
                      const input = document.getElementById("new-username-input") as HTMLInputElement;
                      if (input && input.value.trim()) {
                        try {
                          if (isFirebaseConfigured) {
                            const { getAuth, updateProfile } = await import("firebase/auth");
                            const auth = getAuth();
                            if (auth.currentUser) {
                              await updateProfile(auth.currentUser, { displayName: input.value.trim() });
                            }
                          } else {
                            // Update local mock user
                            const savedMock = localStorage.getItem("gemma_mock_user");
                            if (savedMock) {
                              const parsed = JSON.parse(savedMock);
                              parsed.displayName = input.value.trim();
                              localStorage.setItem("gemma_mock_user", JSON.stringify(parsed));
                            }
                          }
                          // Trigger a re-render by force-updating the user object
                          setCurrentUser({ ...currentUser, displayName: input.value.trim() });
                          alert("Username updated successfully!");
                        } catch (e: any) {
                          alert("Failed to update username: " + e.message);
                        }
                      }
                    }}
                    className="action-btn-primary"
                    style={{ fontSize: "0.75rem", padding: "0.45rem 1rem", borderRadius: "8px", background: "var(--primary)", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Auth Method */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.75rem", background: "rgba(0,0,0,0.02)", border: "1px solid var(--divider)", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Login Method:</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)" }}>
                  {currentUser.email?.includes("google-desktop") ? "Google Account (Desktop)" :
                   currentUser.email?.includes("apple-desktop") ? "Apple ID (Desktop)" :
                   currentUser.email?.includes("google") ? "Google OAuth" :
                   currentUser.email?.includes("apple") ? "Apple OAuth" :
                   "Email & Password"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to log out?")) {
                    try {
                      await signOutUser();
                    } catch (err) {
                      console.error("SignOut error:", err);
                    }
                    localStorage.removeItem("gemma_mock_user");
                    setCurrentUser(null);
                    setIsAccountOpen(false);
                    setView("splash");
                  }
                }}
                className="action-btn-danger"
                style={{ flex: 1, padding: "0.65rem", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
