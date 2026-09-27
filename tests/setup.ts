/**
 * Vitest setup for Firestore rules tests.
 *
 * The Firestore emulator has to be running; `npm run test:rules` starts it via
 * `firebase emulators:exec`. Point the SDK at it rather than the real project —
 * these tests must never touch live data.
 */

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = "demo-classboard";

export const PROJECT_ID = "demo-classboard";
