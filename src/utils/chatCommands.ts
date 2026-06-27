export interface ChatCommand {
  trigger: string;
  name: string;
  description: string;
  promptDescription: string;
}

export const CHAT_COMMANDS: ChatCommand[] = [
  {
    trigger: "/critic",
    name: "Critique Mode",
    description: "Evaluates your knowledge, highlights gaps, and asks challenging questions.",
    promptDescription: "You are a rigorous academic evaluator. Critique the student's understanding of the subject, point out logical flaws or gaps in their knowledge, and ask 1 or 2 deep, conceptual questions to test them further. Keep the tone challenging yet educational."
  },
  {
    trigger: "/imagine",
    name: "Imagine Mode",
    description: "Explains concepts using vivid analogies, scenarios, and real-world stories.",
    promptDescription: "You are a creative educator. Explain the requested concepts using highly descriptive analogies, metaphors, and real-world scenarios. Help the student 'visualize' the computer science or mathematical concept clearly."
  },
  {
    trigger: "/note",
    name: "Refer to Notes",
    description: "Answers using both the ASTU syllabus and your attached notes.",
    promptDescription: "You are a study assistant with access to the user's personal notes. You must refer to and incorporate both the official syllabus context AND the user's personal note contents provided below. Synthesize both sources in your answer."
  },
  {
    trigger: "/noteonly",
    name: "Only Notes Mode",
    description: "Answers using ONLY your attached notes. Syllabus context is ignored.",
    promptDescription: "You are a strict note retrieval assistant. You must answer the user's question using ONLY the content of the attached notes. Do NOT use external information or standard syllabus context. If the answer is not in the notes, state: 'I couldn't find information about this in your notes.'"
  }
];

/**
 * Parses a user input string to detect if it starts with a registered slash command.
 * Returns the command trigger and the clean text.
 */
export function parseMessageCommand(text: string): { command: string | null; cleanText: string } {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return { command: null, cleanText: text };
  }

  // Find first space or end of string
  const spaceIndex = trimmed.indexOf(" ");
  const potentialCommand = spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex);
  
  const matched = CHAT_COMMANDS.find((cmd) => cmd.trigger === potentialCommand);
  if (matched) {
    const cleanText = spaceIndex === -1 ? "" : trimmed.substring(spaceIndex + 1);
    return { command: matched.trigger, cleanText };
  }

  return { command: null, cleanText: text };
}

/**
 * Modifies the base system instruction by injecting command-specific instructions and note content.
 */
export function getModifiedSystemInstruction(
  command: string | null,
  baseInstruction: string,
  attachedNotesContent: string
): string {
  if (!command) return baseInstruction;

  const matched = CHAT_COMMANDS.find((cmd) => cmd.trigger === command);
  if (!matched) return baseInstruction;

  let modifier = matched.promptDescription;

  // Append note contents if utilizing notes commands
  if (command === "/note" || command === "/noteonly") {
    modifier += `\n\n=== ATTACHED PERSONAL NOTES ===\n${attachedNotesContent || "(No notes attached)"}\n================================`;
  }

  return `${baseInstruction}\n\n[COMMAND SKILL ACTIVE: ${matched.name}]\n${modifier}`;
}
