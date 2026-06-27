import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Read Firebase configurations from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if credentials are set
const isConfigured =
  !!firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.apiKey.trim() !== "";

let app: any = null;
let auth: any = null;
export let analytics: any = null;

if (isConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    
    // Safely check if analytics is supported in the current environment
    try {
      isSupported().then((supported) => {
        if (supported && firebaseConfig.measurementId) {
          analytics = getAnalytics(app);
        }
      }).catch((err) => {
        console.warn("Firebase Analytics skipped:", err);
      });
    } catch (analyticsError) {
      console.warn("Firebase Analytics synchronous initialization failed:", analyticsError);
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Auth, falling back to mock mode:", error);
  }
}

export const isFirebaseConfigured = isConfigured && auth !== null;

// Mock Authentication State Management
interface MockUser {
  uid: string;
  email: string;
  displayName: string;
}

let mockListeners: Array<(user: MockUser | null) => void> = [];
let currentMockUser: MockUser | null = (() => {
  const saved = localStorage.getItem("gemma_mock_user");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
})();

const notifyMockListeners = () => {
  mockListeners.forEach((listener) => listener(currentMockUser));
};

// Unified Exported Auth Functions
export const onAuthChanged = (callback: (user: any | null) => void): (() => void) => {
  if (isFirebaseConfigured) {
    return onAuthStateChanged(auth, callback);
  } else {
    // Register mock listener
    mockListeners.push(callback);
    // Execute immediately with current state
    callback(currentMockUser);
    // Return unsubscribe function
    return () => {
      mockListeners = mockListeners.filter((l) => l !== callback);
    };
  }
};

export const signIn = async (email: string, password: string): Promise<any> => {
  if (isFirebaseConfigured) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } else {
    // Mock successful sign in
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    
    const user: MockUser = {
      uid: `mock-uid-${Math.random().toString(36).substring(2, 9)}`,
      email,
      displayName: email.split("@")[0],
    };
    
    currentMockUser = user;
    localStorage.setItem("gemma_mock_user", JSON.stringify(user));
    notifyMockListeners();
    return user;
  }
};

export const signUp = async (email: string, password: string): Promise<any> => {
  if (isFirebaseConfigured) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } else {
    // Mock sign up behaves the same
    return signIn(email, password);
  }
};

export const signOutUser = async (): Promise<void> => {
  if (isFirebaseConfigured) {
    await firebaseSignOut(auth);
  } else {
    currentMockUser = null;
    localStorage.removeItem("gemma_mock_user");
    notifyMockListeners();
  }
};
