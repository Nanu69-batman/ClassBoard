/**
 * Firebase initialisation.
 *
 * Initialisation is lazy so the app still builds and runs without a configured
 * project. Nothing here should run at import time.
 *
 * These config values are public by design — they ship in every browser bundle.
 * Firestore and Storage Security Rules are the actual access boundary.
 */

import { getApp, getApps, initializeApp } from "firebase/app";
import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const env = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfig: FirebaseOptions = env;

const MISSING_KEYS = Object.keys(env).filter((key) => !env[key as keyof typeof env]);

/** True once every web app config value is present. */
export const isFirebaseConfigured = MISSING_KEYS.length === 0;

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

let services: FirebaseServices | null = null;

/**
 * Builds an actionable message. A single missing value, or a missing first
 * value, usually means the file was written as UTF-8 *with a BOM* — which
 * Windows editors and PowerShell do by default and which silently corrupts the
 * first variable name.
 */
function configurationError(): Error {
  const lines = [
    "Firebase is not configured. Copy .env.example to .env and fill in the values " +
      "from Firebase console → Project settings → Your apps → SDK setup and configuration.",
  ];

  if (MISSING_KEYS.length > 0) {
    lines.push(`Missing: ${MISSING_KEYS.join(", ")}`);
  }

  if (MISSING_KEYS.length === 1 || MISSING_KEYS.includes("apiKey")) {
    lines.push(
      'If the values are visibly present in .env, the file was likely saved as ' +
        '"UTF-8 with BOM" (PowerShell\'s Out-File and older Notepad do this by ' +
        "default), which corrupts the first variable name. Re-save it as plain UTF-8.",
    );
  }

  return new Error(lines.join(" "));
}

/**
 * Returns the initialised services, creating them on first call.
 *
 * @throws if the project is not configured yet. Callers that can degrade
 * gracefully should check {@link isFirebaseConfigured} first.
 */
export function getFirebase(): FirebaseServices {
  if (services) return services;
  if (!isFirebaseConfigured) throw configurationError();

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    storage: getStorage(app),
  };

  return services;
}
