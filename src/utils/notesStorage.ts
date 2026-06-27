export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  semester?: string;
  subjectCode?: string;
  subjectName?: string;
  format?: string; // e.g. "Presentation", "Teacher note", "Own notes", "Image files", "Other"
}

export interface SavedChat {
  id: string;
  title: string;
  messages: Array<{
    role: "user" | "model" | "assistant";
    content: string;
  }>;
  createdAt: number;
  semester?: string;
  subjectCode?: string;
  subjectName?: string;
}

const NOTES_KEY = "gemma_notes";
const SAVED_CHATS_KEY = "gemma_saved_chats";

/**
 * ==========================================
 * NOTE OPERATIONS (Cloud GCS migration ready)
 * ==========================================
 */

export function getNotes(): Note[] {
  // FUTURE CLOUD WORK: Fetch notes from GCS bucket via API endpoint
  const saved = localStorage.getItem(NOTES_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveNote(note: Note): void {
  const notes = getNotes();
  const index = notes.findIndex((n) => n.id === note.id);
  
  const updatedNote = {
    ...note,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    notes[index] = updatedNote;
  } else {
    notes.unshift(updatedNote);
  }

  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

  // FUTURE CLOUD WORK: Upload updatedNote stringified JSON to GCS bucket:
  // fetch('/api/gcs/notes/' + note.id, { method: 'POST', body: JSON.stringify(updatedNote) })
}

export function createNote(noteData: Omit<Note, "id" | "createdAt" | "updatedAt">): Note {
  const newNote: Note = {
    ...noteData,
    id: `note-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  saveNote(newNote);
  return newNote;
}

export function deleteNote(id: string): void {
  const notes = getNotes();
  const filtered = notes.filter((n) => n.id !== id);
  localStorage.setItem(NOTES_KEY, JSON.stringify(filtered));

  // FUTURE CLOUD WORK: Delete file from GCS bucket:
  // fetch('/api/gcs/notes/' + id, { method: 'DELETE' })
}

/**
 * ==========================================
 * SAVED CHAT OPERATIONS
 * ==========================================
 */

export function getSavedChats(): SavedChat[] {
  // FUTURE CLOUD WORK: Fetch saved chats history from GCS bucket
  const saved = localStorage.getItem(SAVED_CHATS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveChat(chat: SavedChat): void {
  const chats = getSavedChats();
  const index = chats.findIndex((c) => c.id === chat.id);
  
  if (index >= 0) {
    chats[index] = chat;
  } else {
    chats.unshift(chat);
  }

  localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(chats));

  // FUTURE CLOUD WORK: Sync saved chat session to GCS bucket
}

export function createSavedChat(
  title: string,
  messages: SavedChat["messages"],
  semester?: string,
  subjectCode?: string,
  subjectName?: string
): SavedChat {
  const newChat: SavedChat = {
    id: `chat-${Math.random().toString(36).substring(2, 9)}`,
    title,
    messages,
    createdAt: Date.now(),
    semester,
    subjectCode,
    subjectName,
  };

  saveChat(newChat);
  return newChat;
}

export function deleteSavedChat(id: string): void {
  const chats = getSavedChats();
  const filtered = chats.filter((c) => c.id !== id);
  localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(filtered));

  // FUTURE CLOUD WORK: Delete chat file from GCS bucket
}
