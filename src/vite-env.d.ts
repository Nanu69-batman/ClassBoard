/// <reference types="vite/client" />

/**
 * Firebase web app configuration.
 *
 * Vite only exposes variables prefixed with `VITE_` to the browser, and only
 * these six values are ever read. They are public by design — Firebase Security
 * Rules are the access boundary, not these values. The genuinely private file
 * is the service-account JSON used by the seed script, which must never be
 * committed.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
