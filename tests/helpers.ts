/**
 * Seed helpers and fixtures for the rules tests.
 *
 * Documents are written with the admin context, which bypasses rules entirely —
 * that is how a test arranges a starting state that the rules themselves would
 * never permit to be created.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";

import { PROJECT_ID } from "./setup";

const rulesPath = fileURLToPath(new URL("../firestore.rules", import.meta.url));

export async function makeEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(rulesPath, "utf8") },
  });
}

// Return types are inferred on purpose. @firebase/rules-unit-testing resolves its
// own Firestore types, and naming them here forces TypeScript to reconcile two
// declarations that are structurally identical but nominally different.

/** A signed-in identity with no users/{uid} document — the self-registered stranger. */
export function stranger(env: RulesTestEnvironment) {
  return env.authenticatedContext("stranger-uid").firestore();
}

/** An active CR of classA. */
export function crOfA(env: RulesTestEnvironment) {
  return env.authenticatedContext("cr-a-uid").firestore();
}

/** A second active CR of classA, for transfer tests. */
export function crOfA2(env: RulesTestEnvironment) {
  return env.authenticatedContext("cr-a2-uid").firestore();
}

/** An active CR of classB. */
export function crOfB(env: RulesTestEnvironment) {
  return env.authenticatedContext("cr-b-uid").firestore();
}

export function superadmin(env: RulesTestEnvironment) {
  return env.authenticatedContext("admin-uid").firestore();
}

/** A CR whose account has been deactivated by a transfer. */
export function revokedCr(env: RulesTestEnvironment) {
  return env.authenticatedContext("cr-a-uid").firestore();
}

export const paths = {
  classA: "classes/ece-2026-a",
  classB: "classes/cse-2026-a",
  subjectA: "classes/ece-2026-a/subjects/maths",
  subjectB: "classes/cse-2026-a/subjects/os",
  assignmentA: "classes/ece-2026-a/assignments/a1",
  assignmentB: "classes/cse-2026-a/assignments/b1",
  userCrA: "users/cr-a-uid",
  userCrA2: "users/cr-a2-uid",
  userCrB: "users/cr-b-uid",
  userAdmin: "users/admin-uid",
  userStranger: "users/stranger-uid",
  invite: "crInvites/tok-1",
  inviteExpired: "crInvites/tok-expired",
};

const HOUR = 60 * 60 * 1000;

function ts(offsetMs: number) {
  return Timestamp.fromMillis(Date.now() + offsetMs);
}

export function classDoc(overrides: Record<string, unknown> = {}) {
  return {
    name: "ECE",
    batch: "2026",
    section: "A",
    displayName: "ECE • 2026 • A",
    active: true,
    createdAt: ts(0),
    ...overrides,
  };
}

export function subjectDoc(overrides: Record<string, unknown> = {}) {
  return { name: "Engineering Mathematics", shortName: "Maths", active: true, ...overrides };
}

export function assignmentDoc(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: "maths",
    subjectName: "Engineering Mathematics",
    title: "Assignment 2",
    description: "Solve questions 1-10 from Unit 2.",
    dueDate: "2026-09-30",
    // Empty, not null: this fixture has a real date, so it has no standing note.
    // `contactEmail` is here too, because validAssignment() hasOnly() rejects the
    // whole write if a single expected key is missing.
    dueNote: "",
    priority: "high",
    attachmentUrl: null,
    attachmentName: null,
    contactEmail: null,
    createdBy: "cr-a-uid",
    postedByName: "Asha Rao",
    createdAt: ts(0),
    updatedAt: ts(0),
    active: true,
    ...overrides,
  };
}

export function userDoc(overrides: Record<string, unknown> = {}) {
  return {
    email: "cr@example.edu",
    displayName: "Asha Rao",
    role: "cr",
    classId: "ece-2026-a",
    active: true,
    createdAt: ts(0),
    ...overrides,
  };
}

export function adminDoc(overrides: Record<string, unknown> = {}) {
  return {
    email: "admin@example.edu",
    displayName: "Superadmin",
    role: "superadmin",
    active: true,
    createdAt: ts(0),
    ...overrides,
  };
}

export function inviteDoc(overrides: Record<string, unknown> = {}) {
  return {
    classId: "ece-2026-a",
    forPreviousUid: null,
    createdBy: "admin-uid",
    createdAt: ts(0),
    expiresAt: ts(24 * HOUR),
    used: false,
    usedBy: null,
    ...overrides,
  };
}

/**
 * Writes a fixture document with rules bypassed.
 *
 * Every privileged write in the suite goes through here, so it is obvious in
 * review which writes are arranging state and which are exercising the rules.
 */
export async function put(
  env: RulesTestEnvironment,
  path: string,
  data: Record<string, unknown>,
) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

/**
 * Arranges the world.
 *
 * withSecurityRulesDisabled is the supported way to write state the rules would
 * never permit — which is exactly what a fixture needs, and states the intent
 * out loud so nobody copies this pattern into app code.
 */
export async function seedWorld(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, paths.classA), classDoc());
    await setDoc(doc(db, paths.classB), classDoc({ displayName: "CSE • 2026 • A", name: "CSE" }));
    await setDoc(doc(db, paths.subjectA), subjectDoc());
    await setDoc(doc(db, paths.subjectB), subjectDoc({ name: "Operating Systems", shortName: "OS" }));
    await setDoc(doc(db, paths.assignmentA), assignmentDoc());
    await setDoc(doc(db, paths.assignmentB), assignmentDoc({ createdBy: "cr-b-uid" }));

    await setDoc(doc(db, paths.userAdmin), adminDoc());
    await setDoc(doc(db, paths.userCrA), userDoc());
    await setDoc(doc(db, paths.userCrA2), userDoc({ email: "cr2@example.edu", displayName: "Bhavya Iyer" }));
    await setDoc(doc(db, paths.userCrB), userDoc({ classId: "cse-2026-a", email: "crb@example.edu" }));
  });
}

/** Arranges a consumed invite for cr-a2-uid, naming cr-a-uid as the outgoing CR. */
export async function seedConsumedTransferInvite(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), paths.invite),
      inviteDoc({ used: true, usedBy: "cr-a2-uid", forPreviousUid: "cr-a-uid" }),
    );
  });
}

export { assertFails, assertSucceeds, setDoc, doc, ts, HOUR };
