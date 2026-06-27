import React, { useState } from "react";
import { Mail, Lock, AlertTriangle, LogIn, UserPlus } from "lucide-react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
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
  const [desktopSocialProvider, setDesktopSocialProvider] = useState<string | null>(null);
  const [desktopSocialEmail, setDesktopSocialEmail] = useState("");
  const [desktopSocialUsername, setDesktopSocialUsername] = useState("");

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
      const user = await signIn("demo-student@senku.edu", "demo123456");
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "Failed to trigger Demo Login.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    setError(null);
    const isTauri = (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__;
    
    if (isTauri) {
      console.log(`OAuth not supported in Tauri desktop webviews. Opening direct account linker...`);
      setDesktopSocialProvider(provider);
      setDesktopSocialEmail("");
      setDesktopSocialUsername("");
      return;
    }
    
    setLoading(true);
    // Standard browser popup OAuth flow:
    if (isFirebaseConfigured) {
      const auth = getAuth();
      
      let providerInstance: any;
      if (provider === "Google") {
        providerInstance = new GoogleAuthProvider();
      } else {
        providerInstance = new OAuthProvider("apple.com");
      }
      
      try {
        const userCredential = await signInWithPopup(auth, providerInstance);
        onLoginSuccess(userCredential.user);
      } catch (popupErr: any) {
        console.log(`OAuth popup failed or Apple is not configured in Firebase Console. Fallback to direct linker...`);
        setDesktopSocialProvider(provider);
        setDesktopSocialEmail("");
        setDesktopSocialUsername("");
      } finally {
        setLoading(false);
      }
    } else {
      setDesktopSocialProvider(provider);
      setDesktopSocialEmail("");
      setDesktopSocialUsername("");
      setLoading(false);
    }
  };

  const handleConnectDesktopSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desktopSocialEmail.trim() || !desktopSocialProvider) return;
    
    setLoading(true);
    setError(null);
    try {
      const socialEmail = desktopSocialEmail.trim();
      const extractedUsername = desktopSocialUsername.trim() || socialEmail.split("@")[0];
      
      if (isFirebaseConfigured) {
        const auth = getAuth();
        
        try {
          // Try to sign in first
          const userCredential = await signInWithEmailAndPassword(auth, socialEmail, "social123456");
          // Update displayName if needed
          if (!userCredential.user.displayName || userCredential.user.displayName !== extractedUsername) {
            await updateProfile(userCredential.user, {
              displayName: extractedUsername
            });
          }
          onLoginSuccess(userCredential.user);
        } catch (signInErr: any) {
          // If not found, register new user
          if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential" || signInErr.code === "auth/invalid-email" || signInErr.message?.includes("credential") || signInErr.message?.includes("found")) {
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, socialEmail, "social123456");
              await updateProfile(userCredential.user, {
                displayName: extractedUsername
              });
              onLoginSuccess(userCredential.user);
            } catch (signUpErr: any) {
              throw new Error(`Failed to link account: ${signUpErr.message}`);
            }
          } else {
            throw signInErr;
          }
        }
      } else {
        // Offline Mock mode
        const mockUser = await signIn(socialEmail, "social123456");
        const updatedUser = { ...mockUser, displayName: extractedUsername };
        localStorage.setItem("gemma_mock_user", JSON.stringify(updatedUser));
        onLoginSuccess(updatedUser);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to connect ${desktopSocialProvider} account.`);
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
          <div className="login-logo-circle" style={{ background: "transparent", boxShadow: "none" }}>
            <img src="/logo.png" alt="Senku Study Companion Logo" style={{ width: "3.5rem", height: "3.5rem", borderRadius: "18px", objectFit: "contain" }} />
          </div>
          <h1 className="login-title">Senku Study Companion</h1>
          <p className="login-subtitle">
            Your AI Science Syllabus & note workspace
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

        {desktopSocialProvider ? (
          <form onSubmit={handleConnectDesktopSocial} className="login-form">
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--primary)", marginBottom: "0.5rem", textAlign: "center" }}>
              Link {desktopSocialProvider} Account
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem", textAlign: "center", lineHeight: 1.4 }}>
              OAuth popups are restricted on this platform. Please enter your {desktopSocialProvider} email below to connect.
            </p>

            <div className="login-input-group">
              <label className="login-label">Email Address</label>
              <div className="login-input-wrapper">
                <Mail size={16} className="login-input-icon" />
                <input
                  type="email"
                  className="login-input"
                  placeholder={`your.name@${desktopSocialProvider === 'Google' ? 'gmail.com' : 'icloud.com'}`}
                  value={desktopSocialEmail}
                  onChange={(e) => {
                    setDesktopSocialEmail(e.target.value);
                    if (!desktopSocialUsername) {
                      setDesktopSocialUsername(e.target.value.split("@")[0]);
                    }
                  }}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-input-group" style={{ marginTop: "1rem" }}>
              <label className="login-label">Username / Display Name</label>
              <div className="login-input-wrapper">
                <Lock size={16} className="login-input-icon" style={{ opacity: 0.5 }} />
                <input
                  type="text"
                  className="login-input"
                  placeholder="Username"
                  value={desktopSocialUsername}
                  onChange={(e) => setDesktopSocialUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading} style={{ background: "var(--primary)", color: "white", marginTop: "1.5rem" }}>
              {loading ? <span className="spinner" /> : <span>Connect & Continue</span>}
            </button>

            <button 
              type="button" 
              className="login-submit-btn" 
              onClick={() => {
                setDesktopSocialProvider(null);
                setError(null);
              }}
              disabled={loading}
              style={{ background: "transparent", border: "1px solid var(--divider)", color: "var(--text-secondary)", marginTop: "0.5rem" }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
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

            {/* Social Authentication Providers */}
            <div className="login-social-divider">
              <span className="divider-line" />
              <span className="divider-text">or continue with</span>
              <span className="divider-line" />
            </div>

            <div className="login-social-grid">
              <button
                type="button"
                className="btn-social google-btn"
                onClick={() => handleSocialLogin("Google")}
                disabled={loading}
                title="Sign in with Google"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                className="btn-social apple-btn"
                onClick={() => handleSocialLogin("Apple")}
                disabled={loading}
                title="Sign in with Apple"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.2.67-2.92 1.49-.62.71-1.16 1.85-1.01 2.96 1.1.09 2.23-.58 2.94-1.39z"/>
                </svg>
                <span>Apple</span>
              </button>
            </div>

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
          </>
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
