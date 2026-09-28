/**
 * Firebase initialisation — the part a student needs.
 *
 * ## Why the config below is committed
 *
 * Every value in `firebaseConfig` is public by design. Firebase web config is
 * not a secret — it is compiled into the browser bundle, so anyone loading the
 * deployed site already has it. Hiding it in `.env` or `.gitignore` would change
 * nothing about who can read it, and would stop anyone cloning this repo from
 * running the app.
 *
 * What actually protects the project:
 *
 *   1. `firestore.rules` / `storage.rules` — the real access boundary
 *   2. An API key restricted by HTTP referrer in Google Cloud Console
 *   3. App Check (below) — rejects requests that do not come from a real browser
 *
 * The one genuinely private credential is the service-account JSON used by the
 * local seed script. That stays out of git, and no value here can impersonate it.
 *
 * To point this at a different project, change these values. Copy them from
 * Firebase console → Project settings → Your apps.
 *
 * ## Why this file stops at Firestore
 *
 * A student reads the public feed and that is all. They never authenticate, so
 * `firebase/auth` is dead weight on their critical path — and it is one of the
 * larger modules in the SDK. Auth and Storage are initialised in
 * `firebasePrivileged.ts`, which only the lazily loaded `/cr` and `/admin`
 * bundles import. A student's download carries the Firestore SDK because M4
 * genuinely puts real data on their dashboard; it does not carry the auth SDK,
 * because nothing in their session needs it.
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyDR_y2B1EhH0AuWFbdODZ_9coiSZal2KMI",
  authDomain: "classboard-de77d.firebaseapp.com",
  projectId: "classboard-de77d",
  storageBucket: "classboard-de77d.firebasestorage.app",
  messagingSenderId: "45495912713",
  appId: "1:45495912713:web:160efae3117df2a37eabd8",
  // Present in the project but deliberately unused: analytics is out of scope
  // and nothing calls getAnalytics().
  measurementId: "G-6PE7B5008L",
};

/**
 * reCAPTCHA v3 site key. Public, like the rest of the config.
 * Empty until it is created in Google Cloud Console → APIs & Services →
 * reCAPTCHA Enterprise, then registered as a web app key.
 */
const recaptchaSiteKey = "";

export const firebaseApp = initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);

/**
 * App Check attaches a proof-of-site token to outgoing requests, and Firebase
 * rejects requests without a valid one. This is the server-enforced equivalent
 * of a CAPTCHA: a form field can be deleted from the page, but the token is
 * checked by Firebase itself.
 *
 * Note it protects *automated* callers. A person using the real site still gets
 * a valid token, which is correct — they are a legitimate visitor. What it stops
 * is scripts using the committed API key to scrape Firestore directly, which is
 * now a live concern: the student feed is public and unauthenticated.
 *
 * Skipped when no site key is configured, so the app runs either way.
 */
if (recaptchaSiteKey) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
