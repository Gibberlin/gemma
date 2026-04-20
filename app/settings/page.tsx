"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FiCheckCircle, FiXCircle, FiLoader, FiArrowLeft, FiAlertTriangle } from "react-icons/fi";

type LlmMode = "local" | "cloud";
type CloudProvider = "openai" | "gemini" | "groq" | "huggingface" | "cohere";

interface LlmConfig {
  mode: LlmMode;
  local: {
    endpoint: string;
    model: string;
  };
  cloud: {
    provider: CloudProvider;
    apiKey: string;
    model: string;
  };
}

const isProd = process.env.NODE_ENV === "production";

const defaultConfig: LlmConfig = {
  mode: "local",
  local: {
    endpoint: "http://localhost:1234/v1",
    model: "google/gemma-4-e2b",
  },
  cloud: isProd ? {
    provider: "openai",
    apiKey: "",
    model: "",
  } : {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o",
  },
};

type TestStatus = {
  type: "idle" | "loading" | "success" | "error" | "warning";
  message: string;
};

// Explicit Electron check requirement
const isElectron = () => 
  typeof window !== "undefined" &&
  (window as any).electron &&
  typeof (window as any).electron.invoke === "function";

function StatusBadge({ status }: { status: TestStatus }) {
  if (status.type === "idle") return null;

  if (status.type === "loading") {
    return (
      <span className="text-sm text-text-secondary flex items-center gap-2 animate-pulse font-medium">
        <FiLoader className="animate-spin" /> {status.message}
      </span>
    );
  }

  if (status.type === "success") {
    return (
      <span className="text-sm text-success font-semibold flex items-center gap-1.5">
        <FiCheckCircle className="w-4 h-4" /> {status.message}
      </span>
    );
  }

  if (status.type === "warning") {
    return (
      <span className="text-sm text-warning font-semibold flex items-center gap-1.5">
        <FiAlertTriangle className="w-4 h-4" /> {status.message}
      </span>
    );
  }

  return (
    <span className="text-sm text-danger font-semibold flex items-center gap-1.5">
      <FiXCircle className="w-4 h-4" /> {status.message}
    </span>
  );
}

export default function SettingsPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [config, setConfig] = useState<LlmConfig>(defaultConfig);
  const [testStatus, setTestStatus] = useState<TestStatus>({ type: "idle", message: "" });

  useEffect(() => {
    const saved = localStorage.getItem("gemma_llm_config");
    let initialEndpoint = defaultConfig.local.endpoint;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig((prev) => ({ ...prev, ...parsed }));
        if (parsed.local?.endpoint) {
          initialEndpoint = parsed.local.endpoint;
        }
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    setIsMounted(true);

    // Auto-sync available models
    const fetchModels = async () => {
      try {
        const res = await fetch(`${initialEndpoint}/models`);
        const data = await res.json();

        if (data.data?.length) {
          setConfig((prev) => ({
            ...prev,
            local: { ...prev.local, model: data.data[0].id }
          }));
        }
      } catch (err) {
        console.error("Failed to fetch models");
      }
    };
    fetchModels();
  }, []);

  const updateConfig = (newConfig: LlmConfig) => {
    setConfig(newConfig);
    localStorage.setItem("gemma_llm_config", JSON.stringify(newConfig));
    // Reset test status if mode changes
    if (newConfig.mode !== config.mode) {
      setTestStatus({ type: "idle", message: "" });
    }
  };

  const handleLocalChange = (key: keyof LlmConfig["local"], value: string) => {
    updateConfig({ ...config, local: { ...config.local, [key]: value } });
  };

  const handleCloudChange = (key: keyof LlmConfig["cloud"], value: string) => {
    updateConfig({ ...config, cloud: { ...config.cloud, [key]: value } });
  };

  const testLocalConnection = async () => {
    setTestStatus({ type: "loading", message: "Connecting..." });
    
    if (!isElectron()) {
      setTestStatus({ type: "warning", message: "Electron IPC not found" });
      return;
    }

    try {
      const res = await (window as any).electron.invoke("test_local_llm", {
        url: config.local.endpoint,
        model: config.local.model,
      });

      if (res && res.success !== false) {
        setTestStatus({ type: "success", message: "Connected successfully" });
      } else {
        setTestStatus({ type: "error", message: "Failed to connect to LM Studio" });
      }
    } catch (error: any) {
      setTestStatus({ type: "error", message: "Failed to connect to LM Studio" });
    }
  };

  // Avoid hydration mismatch
  if (!isMounted) return <div className="min-h-screen bg-transparent" />;

  return (
    <div className="min-h-screen text-foreground pb-20 selection:bg-primary-weak selection:text-primary-strong relative">
      
      {/* Dimmed Illustrated Background Effect */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-primary/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        
        {/* Header */}
        <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm font-medium opacity-70 hover:opacity-100 hover:text-primary transition-colors"
              >
                <FiArrowLeft /> Back to Home
              </Link>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
              Configuration
            </h1>
          </div>
        </header>

        {/* Toggle / Status Bar */}
        <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface/60 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-divider">
          <div className="flex bg-background/80 p-1.5 rounded-xl border border-divider shadow-inner w-full sm:w-auto">
            <button
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
                config.mode === "local"
                  ? "bg-primary text-white shadow-md transform scale-[1.02]"
                  : "hover:bg-surface text-text-secondary opacity-80"
              }`}
              onClick={() => updateConfig({ ...config, mode: "local" })}
            >
              Local (LM Studio)
            </button>
            <button
              className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
                config.mode === "cloud"
                  ? "bg-primary text-white shadow-md transform scale-[1.02]"
                  : "hover:bg-surface text-text-secondary opacity-80"
              }`}
              onClick={() => updateConfig({ ...config, mode: "cloud" })}
            >
              Cloud API
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-2">
            <div className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.mode === 'local' ? 'bg-success' : 'bg-primary'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${config.mode === 'local' ? 'bg-success' : 'bg-primary'}`}></span>
            </div>
            <span className="text-sm font-medium text-text-secondary">
              Current Mode: <strong className="text-text-primary capitalize">{config.mode}</strong>
            </span>
          </div>
        </div>

        {/* Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          
          {/* Local LLM Card (Active) */}
          <div
            className={`flex flex-col bg-surface/90 backdrop-blur-lg border rounded-2xl p-6 sm:p-8 transition-all duration-300 ease-in-out ${
              config.mode === "local"
                ? "border-primary/50 shadow-xl ring-1 ring-primary/20 transform lg:-translate-y-1"
                : "border-divider shadow-sm opacity-60 grayscale-[40%] hover:opacity-100 hover:grayscale-0 cursor-pointer"
            }`}
            onClick={() => config.mode !== "local" && updateConfig({ ...config, mode: "local" })}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Local LLM</h2>
              {config.mode === "local" && (
                <span className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase bg-success-weak text-success rounded-full border border-success/20">
                  ACTIVE
                </span>
              )}
            </div>
            
            <p className="text-sm text-text-secondary opacity-90 mb-8 leading-relaxed">
              Connect to LM Studio, Ollama, or any OpenAI-compatible local server running on your machine.
              <br />
              <span className="opacity-70 text-xs">Default offline model: <strong>google/gemma-4-e2b</strong></span>
            </p>

            <div className="space-y-6 flex-1">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={config.local.endpoint}
                  onChange={(e) => handleLocalChange("endpoint", e.target.value)}
                  className="w-full rounded-xl border border-divider bg-background/50 px-4 py-3 font-mono text-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-weak focus:bg-surface shadow-inner placeholder:opacity-50"
                  placeholder="http://localhost:1234/v1"
                  readOnly={config.mode !== "local"}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
                  Model Name
                </label>
                <input
                  type="text"
                  value={config.local.model}
                  onChange={(e) => handleLocalChange("model", e.target.value)}
                  className="w-full rounded-xl border border-divider bg-background/50 px-4 py-3 font-mono text-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-weak focus:bg-surface shadow-inner placeholder:opacity-50"
                  placeholder="google/gemma-4-e2b"
                  readOnly={config.mode !== "local"}
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-divider flex items-center justify-between min-h-[3rem]">
              <button
                onClick={(e) => { e.stopPropagation(); testLocalConnection(); }}
                disabled={testStatus.type === "loading" || config.mode !== "local" || !isElectron()}
                className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-strong hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {testStatus.type === "loading" && config.mode === "local" ? "Testing..." : "Test Connection"}
              </button>

              {config.mode === "local" && (
                !isElectron() ? (
                  <span className="text-sm font-medium text-warning opacity-90">Local LLM only works in desktop app</span>
                ) : (
                  <StatusBadge status={testStatus} />
                )
              )}
            </div>
          </div>

          {/* Cloud LLM Card (Disabled Visuals) */}
          <div
            className={`flex flex-col bg-surface/50 backdrop-blur-sm border rounded-2xl p-6 sm:p-8 transition-all duration-300 ease-in-out pointer-events-none ${
              config.mode === "cloud"
                ? "border-primary/50 shadow-xl ring-1 ring-primary/20 transform lg:-translate-y-1 !pointer-events-auto !bg-surface/90 !backdrop-blur-lg"
                : "border-divider shadow-sm opacity-50 grayscale-[50%] blur-[1px]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Cloud LLM</h2>
              {config.mode === "cloud" && (
                <span className="px-3 py-1 text-[10px] font-bold tracking-widest uppercase bg-success-weak text-success rounded-full border border-success/20">
                  ACTIVE
                </span>
              )}
            </div>
            
            <p className="text-sm text-text-secondary opacity-90 mb-8 leading-relaxed">
              Use external APIs for inference. This requires an internet connection and a valid API key.
              <br />
              <span className="opacity-70 text-xs">Default online model: <strong>gpt-4o</strong></span>
            </p>

            <div className="space-y-6 flex-1">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
                  Provider
                </label>
                <div className="relative">
                  <select
                    value={config.cloud.provider}
                    onChange={(e) => handleCloudChange("provider", e.target.value as CloudProvider)}
                    className="w-full rounded-xl border border-divider bg-background/50 px-4 py-3 font-medium text-sm text-text-primary appearance-none outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-weak focus:bg-surface shadow-inner"
                    disabled={config.mode !== "cloud"}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini (Free)</option>
                    <option value="groq">Groq (Free)</option>
                    <option value="huggingface">Hugging Face (Free)</option>
                    <option value="cohere">Cohere (Free)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-secondary">
                    <svg className="h-4 w-4 fill-current opacity-70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={config.cloud.apiKey}
                  onChange={(e) => handleCloudChange("apiKey", e.target.value)}
                  className="w-full rounded-xl border border-divider bg-background/50 px-4 py-3 font-mono text-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-weak focus:bg-surface shadow-inner tracking-widest placeholder:opacity-50 placeholder:tracking-normal"
                  placeholder="sk-..."
                  readOnly={config.mode !== "cloud"}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2 ml-1">
                  Model
                </label>
                <input
                  type="text"
                  value={config.cloud.model}
                  onChange={(e) => handleCloudChange("model", e.target.value)}
                  className="w-full rounded-xl border border-divider bg-background/50 px-4 py-3 font-mono text-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-weak focus:bg-surface shadow-inner placeholder:opacity-50"
                  placeholder={config.cloud.provider === "openai" ? "gpt-4o" : "gemini-1.5-pro"}
                  readOnly={config.mode !== "cloud"}
                />
              </div>
            </div>
            
            {/* Disabled button state for visual completion */}
            <div className="mt-8 pt-6 border-t border-divider flex items-center justify-between min-h-[3rem]">
              <button
                disabled
                className="inline-flex items-center justify-center rounded-xl bg-text-secondary/20 px-6 py-2.5 text-sm font-semibold text-text-secondary opacity-60 cursor-not-allowed"
              >
                Test API Key
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
