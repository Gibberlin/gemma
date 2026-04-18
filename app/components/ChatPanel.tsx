"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Thinking">
      <span
        className="inline-block h-2 w-2 rounded-full bg-current opacity-60 animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-current opacity-60 animate-pulse"
        style={{ animationDelay: "180ms" }}
      />
      <span
        className="inline-block h-2 w-2 rounded-full bg-current opacity-60 animate-pulse"
        style={{ animationDelay: "360ms" }}
      />
    </span>
  );
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPanel({
  header,
  system,
  placeholder = "Ask a question…",
}: {
  header?: React.ReactNode;
  system: string;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    function onScroll() {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScrollRef.current = remaining < 96;
    }

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scrollToBottom("smooth");
  }, [messages.length, isSending]);

  const canSend = useMemo(
    () => !isSending && input.trim().length > 0,
    [isSending, input],
  );

  async function send() {
    if (!canSend) return;

    const userText = input.trim();
    setInput("");
    setError(null);

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages(nextMessages);
    setIsSending(true);

    requestAnimationFrame(() => scrollToBottom("smooth"));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: nextMessages,
        }),
      });

      const json = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: json.content || "" },
      ]);

      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      {header ? (
        <div className="shrink-0 border-b border-divider px-6 py-4">
          {header}
        </div>
      ) : null}

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-smooth p-6 space-y-6"
      >
        {messages.length === 0 ? (
          <div className="text-sm opacity-70">
            Ask anything about the syllabus/topics for this subject.
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "w-fit max-w-[85%] md:max-w-3xl rounded-2xl bg-primary text-white px-4 py-3 text-sm whitespace-pre-wrap break-words shadow-sm"
                    : "w-fit max-w-[85%] md:max-w-3xl rounded-2xl bg-background border border-divider px-4 py-3 text-sm shadow-sm"
                }
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-slate max-w-none leading-relaxed prose-headings:font-semibold prose-p:my-3 prose-p:text-slate-700 prose-a:underline prose-a:underline-offset-4 prose-pre:my-3 prose-pre:overflow-x-auto prose-table:my-3 prose-hr:border-divider">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        em: ({ node, ...props }) => <strong {...props} />,
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        code: ({ node, className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || "");

                          if (match) {
                            return (
                              <SyntaxHighlighter
                                {...props}
                                language={match[1]}
                                style={oneDark}
                                customStyle={{
                                  margin: 0,
                                  background: "transparent",
                                }}
                                codeTagProps={{
                                  style: {
                                    fontSize: "0.875em",
                                  },
                                }}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            );
                          }

                          return (
                            <code
                              {...props}
                              className="rounded bg-surface px-1 py-0.5 text-sm font-mono"
                            >
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                )}
              </div>
            </div>
          ))
        )}

        {isSending ? (
          <div className="flex justify-start">
            <div className="w-fit max-w-[85%] md:max-w-3xl rounded-2xl bg-background border border-divider px-4 py-3 text-sm animate-pulse shadow-sm">
              <ThinkingDots />
            </div>
          </div>
        ) : null}
      </div>

      <div className="divider shrink-0 p-4 bg-surface/80 backdrop-blur">
        {error ? (
          <div className="mb-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2">
          <textarea
            className="input flex-1 resize-none"
            rows={2}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className="btn-primary h-[48px] px-5"
            onClick={() => void send()}
            disabled={!canSend}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
