import React, { useState } from "react";
import { Mail, Lock, Sparkles, AlertTriangle, LogIn, UserPlus } from "lucide-react";
import { signIn, signUp, isFirebaseConfigured } from "../firebase";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const user = await signUp(email.trim(), password);
        onLoginSuccess(user);
      } else {
        const user = await signIn(email.trim(), password);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signIn("demo@bvec.edu", "demo1234");
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Failed to trigger Demo Login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-overlay">
      <div className="login-glow-bg" />
      
      <div className="login-card">
        {/* Logo and Headers */}
        <div className="login-header">
          <div className="login-logo-circle">
            <Sparkles size={24} className="login-logo-icon" />
          </div>
          <h1 className="login-title">BVEC Study Hub</h1>
          <p className="login-subtitle">
            Your AI Syllabus Companion & Note Organizer
          </p>
        </div>

        {/* Missing Firebase config banner / Mock mode info */}
        {!isFirebaseConfigured && (
          <div className="login-warning-box">
            <AlertTriangle size={16} className="warning-icon" />
            <div>
              <div className="warning-title">Local Demo Mode Active</div>
              <div className="warning-desc">
                Firebase keys are not configured. You can sign in using any mock email/password or click **Demo Sign-In** below.
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {error && <div className="login-error-box">{error}</div>}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <label className="login-label" htmlFor="email-input">Email Address</label>
            <div className="login-input-wrapper">
              <Mail size={16} className="login-input-icon" />
              <input
                id="email-input"
                type="email"
                className="login-input"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-input-group">
            <label className="login-label" htmlFor="password-input">Password</label>
            <div className="login-input-wrapper">
              <Lock size={16} className="login-input-icon" />
              <input
                id="password-input"
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : isSignUp ? (
              <>
                <UserPlus size={16} style={{ marginRight: "6px" }} />
                <span>Create Account</span>
              </>
            ) : (
              <>
                <LogIn size={16} style={{ marginRight: "6px" }} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Mock Login Bypass Button */}
        {!isFirebaseConfigured && (
          <button
            type="button"
            className="login-demo-btn"
            onClick={handleDemoLogin}
            disabled={loading}
          >
            <span>Demo Sign-In</span>
          </button>
        )}

        {/* Footer Toggle */}
        <div className="login-footer">
          {isSignUp ? (
            <span>
              Already have an account?{" "}
              <button
                className="login-toggle-link"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{" "}
              <button
                className="login-toggle-link"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
              >
                Register
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
