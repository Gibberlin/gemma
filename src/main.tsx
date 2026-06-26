import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 1. Global JS Error Listener
window.addEventListener("error", (event) => {
  const errorDiv = document.createElement("div");
  errorDiv.style.position = "fixed";
  errorDiv.style.top = "0";
  errorDiv.style.left = "0";
  errorDiv.style.width = "100vw";
  errorDiv.style.height = "100vh";
  errorDiv.style.background = "rgba(15, 23, 42, 0.98)";
  errorDiv.style.color = "#ef4444";
  errorDiv.style.padding = "2.5rem";
  errorDiv.style.fontFamily = "Consolas, Monaco, monospace";
  errorDiv.style.zIndex = "999999";
  errorDiv.style.overflow = "auto";
  errorDiv.style.boxSizing = "border-box";
  errorDiv.innerHTML = `
    <h1 style="font-size: 1.8rem; margin-bottom: 1rem; border-bottom: 2px solid #ef4444; padding-bottom: 0.5rem;">
      🚨 Global JavaScript Error Detected
    </h1>
    <p style="font-size: 1.1rem; font-weight: bold; color: #f87171;">Message: ${event.message}</p>
    <p style="color: #94a3b8;">Source: ${event.filename}:${event.lineno}:${event.colno}</p>
    <h3 style="margin-top: 1.5rem; color: #e2e8f0;">Stack Trace:</h3>
    <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; font-size: 0.9rem; border: 1px solid #334155; white-space: pre-wrap; word-break: break-all;">
      ${event.error ? event.error.stack : "No stack trace available"}
    </pre>
  `;
  document.body.appendChild(errorDiv);
});

// 2. Global Unhandled Promise Rejection Listener
window.addEventListener("unhandledrejection", (event) => {
  const errorDiv = document.createElement("div");
  errorDiv.style.position = "fixed";
  errorDiv.style.top = "0";
  errorDiv.style.left = "0";
  errorDiv.style.width = "100vw";
  errorDiv.style.height = "100vh";
  errorDiv.style.background = "rgba(15, 23, 42, 0.98)";
  errorDiv.style.color = "#f59e0b";
  errorDiv.style.padding = "2.5rem";
  errorDiv.style.fontFamily = "Consolas, Monaco, monospace";
  errorDiv.style.zIndex = "999999";
  errorDiv.style.overflow = "auto";
  errorDiv.style.boxSizing = "border-box";
  errorDiv.innerHTML = `
    <h1 style="font-size: 1.8rem; margin-bottom: 1rem; border-bottom: 2px solid #f59e0b; padding-bottom: 0.5rem;">
      ⚠️ Unhandled Promise Rejection
    </h1>
    <p style="font-size: 1.1rem; font-weight: bold; color: #fbbf24;">Reason: ${event.reason ? (event.reason.message || event.reason) : "Unknown Reason"}</p>
    <h3 style="margin-top: 1.5rem; color: #e2e8f0;">Details / Stack Trace:</h3>
    <pre style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: 8px; font-size: 0.9rem; border: 1px solid #334155; white-space: pre-wrap; word-break: break-all;">
      ${event.reason ? (event.reason.stack || JSON.stringify(event.reason)) : "No stack trace available"}
    </pre>
  `;
  document.body.appendChild(errorDiv);
});

// 3. React Error Boundary Component
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught render boundary error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "2.5rem",
          background: "rgba(15, 23, 42, 0.98)",
          color: "#f87171",
          fontFamily: "Consolas, Monaco, monospace",
          overflow: "auto",
          height: "100vh",
          boxSizing: "border-box"
        }}>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "1rem", borderBottom: "2px solid #ef4444", paddingBottom: "0.5rem" }}>
            React Component Rendering Crash
          </h1>
          <p style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#fca5a5" }}>
            Error: {this.state.error?.toString()}
          </p>
          <h3 style={{ marginTop: "1.5rem", color: "#e2e8f0" }}>React Component Stack Trace:</h3>
          <pre style={{ background: "rgba(0,0,0,0.5)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", border: "1px solid #334155", whiteSpace: "pre-wrap" }}>
            {this.state.error?.stack}
          </pre>
          <h3 style={{ marginTop: "1.5rem", color: "#e2e8f0" }}>React Fiber Debug Stack:</h3>
          <pre style={{ background: "rgba(0,0,0,0.5)", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem", border: "1px solid #334155", whiteSpace: "pre-wrap" }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
