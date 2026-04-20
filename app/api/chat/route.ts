import { lmStudioChat, type ChatMessage } from "@/lib/lmstudio";
import { getServerEnv } from "@/lib/server-env";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type ChatRequestBody = {
  input?: string;
  messages?: ChatMessage[];
  system?: string;
  isOnline?: boolean;
  model?: string;
};

export async function POST(req: Request) {
  try {
    const serverEnv = getServerEnv();
    const body = (await req.json()) as ChatRequestBody;

    const messages: ChatMessage[] = [];
    if (body.system?.trim()) {
      messages.push({ role: "system", content: body.system.trim() });
    }

    if (Array.isArray(body.messages) && body.messages.length > 0) {
      messages.push(
        ...body.messages.filter(
          (m): m is ChatMessage =>
            !!m &&
            (m.role === "system" ||
              m.role === "user" ||
              m.role === "assistant") &&
            typeof m.content === "string",
        ),
      );
    } else if (body.input?.trim()) {
      messages.push({ role: "user", content: body.input.trim() });
    }

    if (messages.length === 0) {
      return Response.json(
        { error: "Provide `input` or `messages`." },
        { status: 400 },
      );
    }

    if (body.isOnline) {
      if (!serverEnv.geminiApiKey) {
        return Response.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
      }

      const ai = new GoogleGenAI({
        apiKey: serverEnv.geminiApiKey,
      });

      const systemInstruction = body.system?.trim();
      const chatMessages = messages.filter(m => m.role !== 'system');

      const contents = chatMessages.map((m, index) => {
        let text = m.content;

        // Inject system instruction into the first user message
        if (index === 0 && m.role === 'user' && systemInstruction) {
          text = `[System]\n${systemInstruction}\n\n[User]\n${text}`;
        }

        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text }]
        };
      });

      const response = await ai.models.generateContent({
        model: body.model || 'gemini-2.5-flash',
        contents,
      });

      return Response.json({ content: response.text });
    }

    if (!serverEnv.lmStudioBaseUrl || !serverEnv.lmStudioModel) {
      return Response.json({ error: "LMSTUDIO_API_BASE_URL and LMSTUDIO_MODEL must be configured on the server." }, { status: 500 });
    }

    const content = await lmStudioChat(messages, {
      baseUrl: serverEnv.lmStudioBaseUrl,
      apiKey: serverEnv.lmStudioApiKey,
      model: serverEnv.lmStudioModel,
    });

    return Response.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
