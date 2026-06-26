import { useState } from "react";
import { Check, AlertTriangle, ArrowLeft } from "lucide-react";
import { GenerationSettings, testLLMConnection } from "../api";

interface ConfigurationPanelProps {
  settings: GenerationSettings;
  onSave: (newSettings: GenerationSettings) => void;
  onClose?: () => void; // If provided, shows "Back to Home"
  isIntroduction?: boolean;
}

export default function ConfigurationPanel({
  settings,
  onSave,
  onClose,
  isIntroduction = false,
}: ConfigurationPanelProps) {
  // Separate states for Local vs Cloud to configure both concurrently
  const [activeTab, setActiveTab] = useState<"local" | "cloud">(
    settings.provider?.startsWith("local") ? "local" : "cloud"
  );

  // Local card state
  const [localEndpoint, setLocalEndpoint] = useState(
    settings.provider?.startsWith("local") ? settings.customEndpoint || "http://localhost:1234/v1" : "http://localhost:1234/v1"
  );
  const [localModel, setLocalModel] = useState(
    settings.provider?.startsWith("local") ? settings.model || "deepseek-coder-v2-lite-instruct" : "deepseek-coder-v2-lite-instruct"
  );

  // Cloud card state
  const [cloudProvider, setCloudProvider] = useState<"gemini" | "openai" | "anthropic" | "groq">(
    settings.provider?.startsWith("local") ? "gemini" : (settings.provider as any) || "gemini"
  );
  const [cloudApiKey, setCloudApiKey] = useState(
    settings.provider?.startsWith("local") ? "" : settings.apiKey || ""
  );
  const [cloudModel, setCloudModel] = useState(
    settings.provider?.startsWith("local") ? "gemini-2.5-flash" : settings.model || "gemini-2.5-flash"
  );

  // Active indicators (shown only after a connection attempt)
  const [localConnectionStatus, setLocalConnectionStatus] = useState<"untested" | "active" | "inactive">("untested");
  const [cloudConnectionStatus, setCloudConnectionStatus] = useState<"untested" | "active" | "inactive">("untested");

  // Loading indicator for testing connections
  const [isTestingLocal, setIsTestingLocal] = useState(false);
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  // Update default cloud model names when provider changes
  const handleCloudProviderChange = (prov: "gemini" | "openai" | "anthropic" | "groq") => {
    setCloudProvider(prov);
    setCloudConnectionStatus("untested"); // Reset active state on change
    setTestError(null);
    setTestSuccess(null);
    
    switch (prov) {
      case "gemini":
        setCloudModel("gemini-2.5-flash");
        break;
      case "openai":
        setCloudModel("gpt-4o");
        break;
      case "anthropic":
        setCloudModel("claude-3-5-sonnet-latest");
        break;
      case "groq":
        setCloudModel("llama-3.3-70b-versatile");
        break;
    }
  };

  // Test local connection
  const handleTestLocal = async () => {
    setIsTestingLocal(true);
    setTestError(null);
    setTestSuccess(null);
    setLocalConnectionStatus("untested");

    const tempSettings: GenerationSettings = {
      provider: localEndpoint.includes("11434") ? "local-ollama" : "local-openai",
      customEndpoint: localEndpoint.trim(),
      model: localModel.trim(),
      apiKey: "",
      temperature: settings.temperature || 0.7,
      systemInstruction: settings.systemInstruction,
    };

    try {
      const active = await testLLMConnection(tempSettings);
      if (active) {
        setLocalConnectionStatus("active");
        setTestSuccess("Local LLM connection verified successfully!");
      } else {
        setLocalConnectionStatus("inactive");
        setTestError("Failed to establish Local LLM connection.");
      }
    } catch (err: any) {
      setLocalConnectionStatus("inactive");
      setTestError(err.message || "Failed to establish Local LLM connection.");
    } finally {
      setIsTestingLocal(false);
    }
  };

  // Test cloud API connection
  const handleTestCloud = async () => {
    if (!cloudApiKey.trim()) {
      setTestError("Please enter a valid API Key to test.");
      return;
    }
    
    setIsTestingCloud(true);
    setTestError(null);
    setTestSuccess(null);
    setCloudConnectionStatus("untested");

    const tempSettings: GenerationSettings = {
      provider: cloudProvider,
      apiKey: cloudApiKey.trim(),
      model: cloudModel.trim(),
      temperature: settings.temperature || 0.7,
      systemInstruction: settings.systemInstruction,
    };

    try {
      const active = await testLLMConnection(tempSettings);
      if (active) {
        setCloudConnectionStatus("active");
        setTestSuccess(`${cloudProvider.toUpperCase()} Cloud API Key verified successfully!`);
      } else {
        setCloudConnectionStatus("inactive");
        setTestError("Failed to verify Cloud API Key.");
      }
    } catch (err: any) {
      setCloudConnectionStatus("inactive");
      setTestError(err.message || "Failed to verify Cloud API Key.");
    } finally {
      setIsTestingCloud(false);
    }
  };

  // Save selection
  const handleSaveConfig = () => {
    let finalSettings: GenerationSettings;

    if (activeTab === "local") {
      finalSettings = {
        provider: localEndpoint.includes("11434") ? "local-ollama" : "local-openai",
        customEndpoint: localEndpoint.trim(),
        model: localModel.trim(),
        apiKey: "",
        temperature: settings.temperature || 0.7,
        systemInstruction: settings.systemInstruction || "You are a helpful study assistant.",
      };
    } else {
      finalSettings = {
        provider: cloudProvider,
        apiKey: cloudApiKey.trim(),
        model: cloudModel.trim(),
        temperature: settings.temperature || 0.7,
        systemInstruction: settings.systemInstruction || "You are a helpful study assistant.",
      };
    }

    onSave(finalSettings);
    if (onClose) onClose();
  };

  return (
    <div className={isIntroduction ? "page-wrapper" : ""} style={{ width: "100%", animation: "fadeIn 0.3s ease" }}>
      {/* Header back button (only in settings popup mode) */}
      {!isIntroduction && onClose && (
        <div className="back-link" onClick={onClose} style={{ marginBottom: "1rem" }}>
          <ArrowLeft size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
          Back to Home
        </div>
      )}

      {/* Main configuration title */}
      <h1 className="page-title" style={{ marginBottom: "2rem", fontFamily: "Outfit, sans-serif" }}>
        Configuration
      </h1>

      {/* Connection Alerts */}
      {testError && (
        <div
          style={{
            margin: "0 0 1.25rem 0",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            border: "1px solid var(--danger)",
            background: "var(--danger-weak)",
            color: "var(--danger)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={16} />
          <span>{testError}</span>
        </div>
      )}
      {testSuccess && (
        <div
          style={{
            margin: "0 0 1.25rem 0",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            background: "rgba(16, 185, 129, 0.1)",
            color: "#34d399",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Check size={16} />
          <span>{testSuccess}</span>
        </div>
      )}

      {/* Tab bar selection aligned with user screenshots */}
      <div
        className="card"
        style={{
          padding: "0.6rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          borderRadius: "14px",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setActiveTab("local");
              setTestError(null);
              setTestSuccess(null);
            }}
            style={{
              padding: "0.5rem 1rem",
              background: activeTab === "local" ? "var(--primary)" : "transparent",
              color: activeTab === "local" ? "white" : "var(--text-secondary)",
              borderColor: activeTab === "local" ? "transparent" : "var(--divider)",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Local (LM Studio)
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setActiveTab("cloud");
              setTestError(null);
              setTestSuccess(null);
            }}
            style={{
              padding: "0.5rem 1rem",
              background: activeTab === "cloud" ? "var(--primary)" : "transparent",
              color: activeTab === "cloud" ? "white" : "var(--text-secondary)",
              borderColor: activeTab === "cloud" ? "transparent" : "var(--divider)",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            Cloud API
          </button>
        </div>

        {/* Current Mode indicator on the right */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: activeTab === "local" ? "#10b981" : "#3b82f6", // Green for local, Blue for cloud
              display: "inline-block",
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            Current Mode: <strong style={{ color: "var(--text-primary)" }}>{activeTab === "local" ? "Local" : "Cloud"}</strong>
          </span>
        </div>
      </div>

      {/* Two Column configuration cards */}
      <div className="config-cards-grid">
        {/* LOCAL LLM CARD */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            opacity: activeTab === "local" ? 1 : 0.4,
            pointerEvents: activeTab === "local" ? "auto" : "none",
            borderWidth: activeTab === "local" ? "2px" : "1px",
            borderColor: activeTab === "local" ? "var(--primary)" : "var(--divider)",
            position: "relative",
            transition: "all 0.25s ease",
          }}
        >
          {/* Active status badge (only shown if connection is established) */}
          {localConnectionStatus !== "untested" && activeTab === "local" && (
            <span
              className="badge"
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                padding: "0.2rem 0.6rem",
                fontWeight: 700,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                backgroundColor: localConnectionStatus === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: localConnectionStatus === "active" ? "#34d399" : "#f87171",
                border: localConnectionStatus === "active" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              {localConnectionStatus}
            </span>
          )}

          <h2 className="card-title" style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.25rem" }}>
            Local LLM
          </h2>
          <p className="card-desc" style={{ fontSize: "0.82rem", marginTop: 0 }}>
            Connect to LM Studio, Ollama, or any OpenAI-compatible local server running on your machine.
            <br />
            <span style={{ display: "block", marginTop: "0.4rem", color: "var(--text-muted)" }}>
              Default offline model: <strong>google/gemma-4-e2b</strong>
            </span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label className="settings-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Endpoint URL</label>
            <input
              type="text"
              value={localEndpoint}
              onChange={(e) => {
                setLocalEndpoint(e.target.value);
                setLocalConnectionStatus("untested");
              }}
              placeholder="http://localhost:1234/v1"
              className="settings-input"
              style={{ padding: "0.55rem 0.75rem", fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label className="settings-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Model Name</label>
            <input
              type="text"
              value={localModel}
              onChange={(e) => {
                setLocalModel(e.target.value);
                setLocalConnectionStatus("untested");
              }}
              placeholder="deepseek-coder-v2-lite-instruct"
              className="settings-input"
              style={{ padding: "0.55rem 0.75rem", fontSize: "0.85rem" }}
            />
          </div>

          {/* Test connection row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleTestLocal}
              disabled={isTestingLocal}
              style={{
                fontSize: "0.8rem",
                padding: "0.5rem 1rem",
                background: "rgba(99, 102, 241, 0.4)",
                border: "1px solid var(--primary)",
                borderRadius: "8px",
                width: "120px",
              }}
            >
              {isTestingLocal ? "Testing..." : "Test Connection"}
            </button>
            <span style={{ fontSize: "0.7rem", color: "#f97316", fontWeight: 500, maxWidth: "160px", textAlign: "right" }}>
              Local LLM only works in desktop app
            </span>
          </div>
        </div>

        {/* CLOUD LLM CARD */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            opacity: activeTab === "cloud" ? 1 : 0.4,
            pointerEvents: activeTab === "cloud" ? "auto" : "none",
            borderWidth: activeTab === "cloud" ? "2px" : "1px",
            borderColor: activeTab === "cloud" ? "var(--primary)" : "var(--divider)",
            position: "relative",
            transition: "all 0.25s ease",
          }}
        >
          {/* Active status badge (only shown if connection is established) */}
          {cloudConnectionStatus !== "untested" && activeTab === "cloud" && (
            <span
              className="badge"
              style={{
                position: "absolute",
                top: "1.25rem",
                right: "1.25rem",
                padding: "0.2rem 0.6rem",
                fontWeight: 700,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                backgroundColor: cloudConnectionStatus === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: cloudConnectionStatus === "active" ? "#34d399" : "#f87171",
                border: cloudConnectionStatus === "active" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              {cloudConnectionStatus}
            </span>
          )}

          <h2 className="card-title" style={{ fontFamily: "Outfit, sans-serif", fontSize: "1.25rem" }}>
            Cloud LLM
          </h2>
          <p className="card-desc" style={{ fontSize: "0.82rem", marginTop: 0 }}>
            Use external APIs for inference. This requires an internet connection and a valid API key.
            <br />
            <span style={{ display: "block", marginTop: "0.4rem", color: "var(--text-muted)" }}>
              Default online model: <strong>gpt-4o</strong>
            </span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label className="settings-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Provider</label>
            <select
              value={cloudProvider}
              onChange={(e) => handleCloudProviderChange(e.target.value as any)}
              className="settings-select"
              style={{ padding: "0.55rem 0.75rem", fontSize: "0.85rem" }}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic</option>
              <option value="groq">Groq</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label className="settings-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>API Key</label>
            <input
              type="password"
              value={cloudApiKey}
              onChange={(e) => {
                setCloudApiKey(e.target.value);
                setCloudConnectionStatus("untested");
              }}
              placeholder="sk-..."
              className="settings-input"
              style={{ padding: "0.55rem 0.75rem", fontSize: "0.85rem" }}
            />
          </div>

          {/* Test api key row */}
          <div style={{ display: "flex", alignItems: "center", marginTop: "auto", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleTestCloud}
              disabled={isTestingCloud}
              style={{
                fontSize: "0.8rem",
                padding: "0.5rem 1rem",
                background: "rgba(99, 102, 241, 0.4)",
                border: "1px solid var(--primary)",
                borderRadius: "8px",
                width: "120px",
              }}
            >
              {isTestingCloud ? "Testing..." : "Test API Key"}
            </button>
          </div>
        </div>
      </div>

      {/* Save Connection parameters button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSaveConfig}
          style={{
            fontSize: "0.9rem",
            padding: "0.6rem 1.5rem",
            borderRadius: "10px",
          }}
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}
