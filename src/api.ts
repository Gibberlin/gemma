export interface Message {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface GenerationSettings {
  provider: "gemini" | "openai" | "anthropic" | "groq" | "local-ollama" | "local-openai";
  apiKey: string;
  model: string;
  temperature: number;
  systemInstruction?: string;
  customEndpoint?: string; // e.g. http://localhost:1234/v1 for LM Studio
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

/**
 * Main unified streaming API router.
 * Dispatches the streaming prompt to the selected API provider.
 */
export async function generateContentStream(
  settings: GenerationSettings,
  history: Message[],
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (err: Error) => void,
  signal?: AbortSignal
) {
  const { provider, apiKey, model, temperature, systemInstruction, customEndpoint } = settings;

  // 1. Validate inputs
  const isLocal = provider === "local-ollama" || provider === "local-openai";
  if (!isLocal && !apiKey) {
    onError(new Error(`${provider.toUpperCase()} API Key is missing. Please set it in Settings.`));
    return;
  }

  // Helper to convert history to standard OpenAI/Anthropic messages
  const getOpenAIMessages = () => {
    const list: any[] = [];
    if (systemInstruction && systemInstruction.trim() !== "") {
      list.push({ role: "system", content: systemInstruction.trim() });
    }
    history.forEach((m) => {
      // Map roles: model/assistant -> assistant, user -> user
      const role = m.role === "model" ? "assistant" : m.role;
      list.push({ role, content: m.content });
    });
    return list;
  };

  try {
    let url = "";
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: any = {};

    switch (provider) {
      case "gemini": {
        const geminiModel = model || "gemini-2.5-flash";
        url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?key=${apiKey}&alt=sse`;
        
        // Map history to Gemini format: user/model
        const contents = history.map((m) => ({
          role: m.role === "assistant" ? "model" : m.role,
          parts: [{ text: m.content }],
        }));

        body = {
          contents,
          generationConfig: { temperature: temperature ?? 0.7 },
        };

        if (systemInstruction && systemInstruction.trim() !== "") {
          body.systemInstruction = {
            parts: [{ text: systemInstruction.trim() }],
          };
        }
        break;
      }

      case "openai": {
        url = "https://api.openai.com/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body = {
          model: model || "gpt-4o",
          messages: getOpenAIMessages(),
          temperature: temperature ?? 0.7,
          stream: true,
        };
        break;
      }

      case "groq": {
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${apiKey}`;
        body = {
          model: model || "llama-3.3-70b-versatile",
          messages: getOpenAIMessages(),
          temperature: temperature ?? 0.7,
          stream: true,
        };
        break;
      }

      case "anthropic": {
        url = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
        // Bypassing browser-based check issues
        headers["anthropic-danger-out-of-band-requests"] = "true"; 
        
        // Anthropic messages cannot have a system role in messages array
        const systemText = systemInstruction || "";
        const anthropicMsgs = history.map((m) => ({
          role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

        body = {
          model: model || "claude-3-5-sonnet-latest",
          messages: anthropicMsgs,
          max_tokens: 4096,
          temperature: temperature ?? 0.7,
          stream: true,
        };

        if (systemText.trim()) {
          body.system = systemText.trim();
        }
        break;
      }

      case "local-ollama": {
        // Ollama OpenAI-compatible or native endpoint
        const base = customEndpoint?.trim() || "http://localhost:11434";
        url = `${base}/v1/chat/completions`;
        body = {
          model: model || "gemma",
          messages: getOpenAIMessages(),
          temperature: temperature ?? 0.7,
          stream: true,
        };
        break;
      }

      case "local-openai": {
        const base = customEndpoint?.trim() || "http://localhost:1234/v1";
        url = `${base}/chat/completions`;
        body = {
          model: model || "local-model",
          messages: getOpenAIMessages(),
          temperature: temperature ?? 0.7,
          stream: true,
        };
        break;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error (${response.status}): ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error("Response stream is empty.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 1. Handle Server Sent Events (standard data: prefix)
        if (trimmed.startsWith("data:")) {
          const dataStr = trimmed.substring(5).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataStr);

            // Extract content chunk depending on API format
            let chunkText = "";

            if (provider === "gemini") {
              chunkText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else if (provider === "openai" || provider === "groq" || provider === "local-ollama" || provider === "local-openai") {
              chunkText = parsed.choices?.[0]?.delta?.content || "";
            } else if (provider === "anthropic") {
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                chunkText = parsed.delta.text;
              }
            }

            if (chunkText) {
              onChunk(chunkText);
            }
          } catch (err) {
            // Ignore parsing errors of partial lines
          }
        } else {
          // 2. Handle non-SSE or Ollama raw JSON stream lines
          try {
            const parsed = JSON.parse(trimmed);
            let chunkText = "";
            
            // Native Ollama generates responses in {"message": {"content": "..."}} format
            if (parsed.message?.content) {
              chunkText = parsed.message.content;
            } else if (parsed.response) { // Ollama generate format
              chunkText = parsed.response;
            }

            if (chunkText) {
              onChunk(chunkText);
            }
          } catch (err) {
            // Not a JSON chunk line, ignore
          }
        }
      }
    }

    onComplete();
  } catch (err: any) {
    if (err.name === "AbortError") {
      return; // cancelled
    }
    onError(err);
  }
}

/**
 * Test if the connection is active for the configured settings.
 * Returns true if successful, throws an Error if it fails.
 */
export async function testLLMConnection(settings: GenerationSettings): Promise<boolean> {
  const { provider, apiKey, model, customEndpoint } = settings;

  let url = "";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: any = {};

  switch (provider) {
    case "gemini": {
      const m = model || "gemini-2.5-flash";
      url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      body = {
        contents: [{ parts: [{ text: "Ping" }] }],
        generationConfig: { maxOutputTokens: 2 }
      };
      break;
    }
    case "openai": {
      url = "https://api.openai.com/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: model || "gpt-4o-mini",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 2,
        stream: false
      };
      break;
    }
    case "groq": {
      url = "https://api.groq.com/openai/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: model || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 2,
        stream: false
      };
      break;
    }
    case "anthropic": {
      url = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-danger-out-of-band-requests"] = "true";
      body = {
        model: model || "claude-3-5-sonnet-latest",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 2,
        stream: false
      };
      break;
    }
    case "local-ollama": {
      const base = customEndpoint?.trim() || "http://localhost:11434";
      url = `${base}/v1/chat/completions`;
      body = {
        model: model || "gemma",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 2,
        stream: false
      };
      break;
    }
    case "local-openai": {
      const base = customEndpoint?.trim() || "http://localhost:1234/v1";
      url = `${base}/chat/completions`;
      body = {
        model: model || "local-model",
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 2,
        stream: false
      };
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  // Set a short timeout (6 seconds) to avoid hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      let msg = `HTTP Error ${res.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          msg = errorJson.error.message;
        } else if (errorJson.message) {
          msg = errorJson.message;
        }
      } catch (e) {
        if (errorText) msg = errorText;
      }
      throw new Error(msg);
    }

    return true;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 6-second connection attempt.");
    }
    throw err;
  }
}
