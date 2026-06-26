import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Copy, Check, Sparkles, Terminal, BookOpen, Key, AlertTriangle, StopCircle } from "lucide-react";
import { ChatThread } from "../api";

interface ChatWindowProps {
  thread: ChatThread | null;
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  onStopGeneration: () => void;
  apiKeySet: boolean;
  onOpenSettings: () => void;
}

export default function ChatWindow({
  thread,
  onSendMessage,
  isGenerating,
  onStopGeneration,
  apiKeySet,
  onOpenSettings,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages, isGenerating]);

  // Auto-grow input textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopyCode = (code: string, blockId: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(blockId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const suggestions = [
    {
      title: "Write a Debounce Function",
      desc: "Create a TypeScript helper to limit rate of function execution.",
      prompt: "Write a TypeScript function to debounce an API call. Explain how it works with a practical React example.",
      icon: <Terminal size={16} className="text-teal-400" />,
    },
    {
      title: "React 19 Hooks",
      desc: "Learn about the new 'use' hook and server actions.",
      prompt: "Explain React 19's new features, specifically the 'use' hook, Form Actions, and useActionState.",
      icon: <Sparkles size={16} className="text-purple-400" />,
    },
    {
      title: "Tauri File Storage",
      desc: "Methods to read and write files locally in Tauri v2.",
      prompt: "How can I implement secure local file storage in a Tauri application? Please show both frontend TS and backend Rust examples.",
      icon: <BookOpen size={16} className="text-cyan-400" />,
    },
    {
      title: "Optimize Gemini Prompts",
      desc: "Best practices to structure system instructions.",
      prompt: "What are the best practices for writing system instructions for Gemini models to get high-quality, structured JSON responses?",
      icon: <Sparkles size={16} className="text-pink-400" />,
    },
  ];

  // Helper: Inline Markdown parser for formatting bold, inline code, and links
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    // Regular expressions for bold, inline code, and links
    const inlineRegex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const splitParts = text.split(inlineRegex);

    return splitParts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>;
      }
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a key={index} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            {linkMatch[1]}
          </a>
        );
      }
      return part;
    });
  };

  // Helper: Block Markdown parser (paragraphs, headers, lists, code blocks)
  const renderMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    const blockRegex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
    let lastIndex = 0;
    let match;
    let blockIdCounter = 0;

    while ((match = blockRegex.exec(text)) !== null) {
      // 1. Text before the code block
      if (match.index > lastIndex) {
        const textSegment = text.substring(lastIndex, match.index);
        parts.push(renderTextBlocks(textSegment, `text-${lastIndex}`));
      }

      // 2. The code block itself
      const language = match[1] || "code";
      const codeContent = match[2];
      const blockId = `code-block-${blockIdCounter++}-${match.index}`;

      parts.push(
        <div key={blockId} className="code-block-container">
          <div className="code-block-header">
            <span>{language.toUpperCase()}</span>
            <button
              onClick={() => handleCopyCode(codeContent, blockId)}
              className="copy-btn"
              title="Copy code"
            >
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

    // 3. Text after the last code block
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      parts.push(renderTextBlocks(remainingText, `text-end-${lastIndex}`));
    }

    return parts;
  };

  const renderTextBlocks = (text: string, keyPrefix: string): React.ReactNode => {
    const lines = text.split("\n");
    const blocks: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let isInsideList = false;
    let listType: "ul" | "ol" = "ul";

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        if (listType === "ul") {
          blocks.push(<ul key={`ul-${key}`}>{...listItems}</ul>);
        } else {
          blocks.push(<ol key={`ol-${key}`}>{...listItems}</ol>);
        }
        listItems = [];
        isInsideList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Heading 1, 2, 3
      if (trimmed.startsWith("### ")) {
        flushList(`h3-${i}`);
        blocks.push(<h3 key={`h3-${i}`}>{parseInlineMarkdown(trimmed.substring(4))}</h3>);
      } else if (trimmed.startsWith("## ")) {
        flushList(`h2-${i}`);
        blocks.push(<h2 key={`h2-${i}`}>{parseInlineMarkdown(trimmed.substring(3))}</h2>);
      } else if (trimmed.startsWith("# ")) {
        flushList(`h1-${i}`);
        blocks.push(<h1 key={`h1-${i}`}>{parseInlineMarkdown(trimmed.substring(2))}</h1>);
      }
      // Blockquote
      else if (trimmed.startsWith("> ")) {
        flushList(`bq-${i}`);
        blocks.push(<blockquote key={`bq-${i}`}>{parseInlineMarkdown(trimmed.substring(2))}</blockquote>);
      }
      // Bullet list item
      else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        if (!isInsideList || listType !== "ul") {
          flushList(`flush-ul-${i}`);
          isInsideList = true;
          listType = "ul";
        }
        listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(trimmed.substring(2))}</li>);
      }
      // Numbered list item
      else if (/^\d+\.\s/.test(trimmed)) {
        if (!isInsideList || listType !== "ol") {
          flushList(`flush-ol-${i}`);
          isInsideList = true;
          listType = "ol";
        }
        const textAfterNumber = trimmed.replace(/^\d+\.\s/, "");
        listItems.push(<li key={`li-${i}`}>{parseInlineMarkdown(textAfterNumber)}</li>);
      }
      // Empty line
      else if (trimmed === "") {
        flushList(`empty-${i}`);
      }
      // Regular Paragraph line
      else {
        flushList(`p-flush-${i}`);
        blocks.push(<p key={`p-${i}`}>{parseInlineMarkdown(line)}</p>);
      }
    }

    // Flush any leftover list items
    flushList(`final-${keyPrefix}`);

    return <div key={keyPrefix} className="markdown-body">{blocks}</div>;
  };

  return (
    <div className="chat-pane">
      {/* Messages Scroll Area */}
      <div className="chat-messages">
        {/* API Key Missing Warning Banner */}
        {!apiKeySet && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              padding: "1rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              maxWidth: "800px",
              width: "100%",
              margin: "0 auto 1.5rem auto",
            }}
          >
            <AlertTriangle className="text-red-400" size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <strong style={{ color: "#f87171", fontSize: "0.95rem" }}>API Key Required</strong>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                You must configure your Google Gemini API key to start answering questions. It is stored securely on your machine.
              </p>
              <button
                onClick={onOpenSettings}
                className="btn-primary"
                style={{
                  padding: "0.3rem 0.75rem",
                  fontSize: "0.8rem",
                  marginTop: "0.5rem",
                  width: "fit-content",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Key size={12} />
                Open Settings
              </button>
            </div>
          </div>
        )}

        {(!thread || thread.messages.length === 0) ? (
          /* Welcome/Intro Screen */
          <div className="welcome-container">
            <h1 className="welcome-title">What can I help you build?</h1>
            <p className="welcome-subtitle">
              Ask me coding questions, architectural advice, or text requests. I am backed by the Google Gemini models.
            </p>
            <div className="suggestions-grid">
              {suggestions.map((sug, i) => (
                <div
                  key={i}
                  className="suggestion-card"
                  onClick={() => {
                    if (apiKeySet) {
                      setInput(sug.prompt);
                      textareaRef.current?.focus();
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {sug.icon}
                    <span className="suggestion-title">{sug.title}</span>
                  </div>
                  <span className="suggestion-desc">{sug.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation bubbles */
          <div
            style={{
              maxWidth: "800px",
              width: "100%",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            {thread.messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.role}`}>
                <div className="avatar-icon">
                  {msg.role === "user" ? "U" : "G"}
                </div>
                <div className="message-content">
                  {msg.role === "user" ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  ) : (
                    renderMarkdown(msg.content)
                  )}
                </div>
              </div>
            ))}
            {/* Typing Loader Indicator */}
            {isGenerating && (
              <div className="message-bubble model">
                <div className="avatar-icon">G</div>
                <div className="message-content" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)" }}>
                  <Sparkles size={14} className="animate-spin text-purple-400" />
                  <span>Gemma is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input Form */}
      <div className="input-area">
        <form onSubmit={handleSubmit} className="input-wrapper">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !apiKeySet
                ? "Configure API Key in Settings first..."
                : isGenerating
                ? "Gemma is typing..."
                : "Ask anything..."
            }
            className="chat-input"
            disabled={!apiKeySet}
          />
          <div className="input-actions">
            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="send-btn"
                style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
                title="Stop Generating"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !apiKeySet}
                className="send-btn"
                title="Send Question"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </form>
        <div className="footer-disclaimer">
          Gemma Desktop Assistant. Responses are generated by Google Gemini. Double check important information.
        </div>
      </div>
    </div>
  );
}
