export function getServerEnv() {
  return {
    lmStudioBaseUrl: process.env.LMSTUDIO_API_BASE_URL?.trim() || "http://localhost:1234/v1",
    lmStudioModel: process.env.LMSTUDIO_MODEL?.trim() || undefined,
    lmStudioApiKey: process.env.LMSTUDIO_API_KEY?.trim() || undefined,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  };
}
