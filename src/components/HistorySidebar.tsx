import { useState } from "react";
import { Plus, MessageSquare, Trash2, Edit3, Settings, Check, X } from "lucide-react";
import { ChatThread } from "../api";

interface HistorySidebarProps {
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  apiKeySet: boolean;
}

export default function HistorySidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  onOpenSettings,
  apiKeySet,
}: HistorySidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (thread: ChatThread, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(thread.id);
    setEditTitle(thread.title);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle("");
  };

  const saveRename = (id: string, e: React.FormEvent | React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameThread(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  return (
    <aside className="sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="logo-icon">G</div>
        <div className="logo-text">Gemma Assistant</div>
      </div>

      {/* New Chat Button */}
      <button className="new-chat-btn" onClick={onNewThread}>
        <Plus size={16} />
        New Chat
      </button>

      {/* Conversations History List */}
      <div className="history-list">
        {threads.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "2rem", padding: "0 1rem" }}>
            No chat history. Start a new chat above!
          </div>
        ) : (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            const isEditing = thread.id === editingId;

            return (
              <div
                key={thread.id}
                className={`history-item ${isActive ? "active" : ""}`}
                onClick={() => !isEditing && onSelectThread(thread.id)}
              >
                <div className="history-title-container">
                  <MessageSquare size={15} style={{ flexShrink: 0 }} />
                  {isEditing ? (
                    <form
                      onSubmit={(e) => saveRename(thread.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", width: "100%", alignItems: "center" }}
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="settings-input"
                        style={{
                          padding: "0.2rem 0.4rem",
                          fontSize: "0.85rem",
                          height: "1.6rem",
                          borderRadius: "4px",
                        }}
                        autoFocus
                        onBlur={() => {
                          // Save on blur if title changed, otherwise cancel
                          if (editTitle.trim() && editTitle !== thread.title) {
                            onRenameThread(thread.id, editTitle.trim());
                          }
                          setEditingId(null);
                        }}
                      />
                    </form>
                  ) : (
                    <span className="history-title">{thread.title}</span>
                  )}
                </div>

                {!isEditing && (
                  <div className="history-item-actions">
                    <button
                      className="action-btn-icon"
                      onClick={(e) => startRename(thread, e)}
                      title="Rename Chat"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      className="action-btn-icon delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this chat thread?")) {
                          onDeleteThread(thread.id);
                        }
                      }}
                      title="Delete Chat"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
                {isEditing && (
                  <div className="history-item-actions" style={{ opacity: 1 }}>
                    <button
                      className="action-btn-icon"
                      onClick={(e) => saveRename(thread.id, e)}
                      title="Save"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      className="action-btn-icon"
                      onClick={cancelRename}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <button className="settings-trigger" onClick={onOpenSettings}>
          <Settings size={16} />
          <span>Settings</span>
          {!apiKeySet && (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-purple)",
                marginLeft: "auto",
                boxShadow: "0 0 8px var(--accent-purple)",
              }}
              title="API Key Required"
            />
          )}
        </button>
      </div>
    </aside>
  );
}
