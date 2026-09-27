/**
 * The permission matrix, as executable tests.
 *
 * Every deny case here is the point of the exercise: a test that asserts a
 * write is refused documents an intended hole that must stay closed. If a rule
 * is loosened, one of these fails.
 */

import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";

import {
  HOUR,
  adminDoc,
  assignmentDoc,
  assertFails,
  assertSucceeds,
  classDoc,
  crOfA,
  crOfA2,
  crOfB,
  inviteDoc,
  makeEnv,
  paths,
  put,
  revokedCr,
  seedConsumedTransferInvite,
  seedWorld,
  stranger,
  subjectDoc,
  superadmin,
  ts,
  userDoc,
} from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await makeEnv();
});

afterEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe("students and self-registered strangers", () => {
  it("reads the public feed with no account at all", async () => {
    await seedWorld(env);
    const anon = env.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(anon, paths.classA)));
    await assertSucceeds(getDocs(query(collection(anon, "classes/ece-2026-a/assignments"), where("active", "==", true))));
  });

  it("cannot write anything while signed out", async () => {
    const anon = env.unauthenticatedContext().firestore();

    await assertFails(setDoc(doc(anon, paths.classA), classDoc()));
    await assertFails(setDoc(doc(anon, paths.assignmentA), assignmentDoc()));
    await assertFails(updateDoc(doc(anon, paths.assignmentA), { title: "hacked" }));
    await assertFails(deleteDoc(doc(anon, paths.assignmentA)));
  });

  it("a self-registered stranger can read public data but nothing private", async () => {
    await seedWorld(env);
    const s = stranger(env);

    // Public feed: yes.
    await assertSucceeds(getDoc(doc(s, paths.assignmentA)));
    await assertSucceeds(getDocs(query(collection(s, "classes"), where("active", "==", true))));

    // Private: no.
    await assertFails(getDoc(doc(s, paths.userCrA)));
    await assertFails(getDocs(collection(s, "users")));
    await assertFails(getDoc(doc(s, paths.invite)));
    await assertFails(getDocs(collection(s, "crInvites")));
  });

  it("a self-registered stranger cannot write anything", async () => {
    await seedWorld(env);
    const s = stranger(env);

    await assertFails(setDoc(doc(s, paths.assignmentA), assignmentDoc()));
    await assertFails(addDoc(collection(s, "classes"), classDoc()));
    await assertFails(setDoc(doc(s, paths.userStranger), userDoc({ role: "cr" })));
    await assertFails(setDoc(doc(s, paths.userAdmin), adminDoc()));
    await assertFails(deleteDoc(doc(s, paths.assignmentA)));
  });

  it("a deactivated class disappears from the public feed", async () => {
    await seedWorld(env);
    await put(env, paths.classA, classDoc({ active: false }));

    const anon = env.unauthenticatedContext().firestore();

    // A direct get of an inactive class is refused.
    await assertFails(getDoc(doc(anon, paths.classA)));
    // And a list that would return it fails outright, so the client must filter.
    await assertSucceeds(getDocs(query(collection(anon, "classes"), where("active", "==", true), limit(5))));
  });
});

describe("CR permissions", () => {
  it("reads its own class and its own profile", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertSucceeds(getDoc(doc(cr, paths.classA)));
    await assertSucceeds(getDocs(query(collection(cr, "classes/ece-2026-a/assignments"), where("active", "==", true))));
    await assertSucceeds(getDoc(doc(cr, paths.userCrA)));
  });

  it("cannot write to another class", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertFails(setDoc(doc(cr, paths.assignmentB), assignmentDoc({ createdBy: "cr-a-uid" })));
    await assertFails(updateDoc(doc(cr, paths.assignmentB), { title: "hacked" }));
    await assertFails(deleteDoc(doc(cr, paths.assignmentB)));
    await assertFails(setDoc(doc(cr, "classes/cse-2026-a/subjects/newone"), subjectDoc()));
    await assertFails(updateDoc(doc(cr, "classes/cse-2026-a"), { displayName: "Mine now" }));
  });

  it("may read another class's data, because active data is public", async () => {
    // Not a privilege leak. The student feed is deliberately unauthenticated, so
    // an active subject or assignment is readable by any visitor — a CR reading
    // one is no different from a student doing it. The write boundary is the real
    // boundary, and it is asserted in the test above.
    await seedWorld(env);
    const cr = crOfA(env);

    await assertSucceeds(getDoc(doc(cr, paths.subjectB)));
    await assertSucceeds(getDoc(doc(cr, paths.assignmentB)));
  });

  it("cannot read another class's deactivated data", async () => {
    // Deactivating a class is what removes it from public view, so this is the
    // read that must be refused once it happens.
    await seedWorld(env);
    await put(env, "classes/cse-2026-a", classDoc({ name: "CSE", active: false }));
    await put(env, "classes/cse-2026-a/subjects/os", subjectDoc({ active: false }));

    const cr = crOfA(env);

    await assertFails(getDoc(doc(cr, "classes/cse-2026-a")));
    await assertFails(getDoc(doc(cr, "classes/cse-2026-a/subjects/os")));
  });

  it("creates, edits and deactivates its own class's assignments", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertSucceeds(
      setDoc(doc(cr, "classes/ece-2026-a/assignments/new"), assignmentDoc({ title: "Assignment 3" })),
    );
    await assertSucceeds(updateDoc(doc(cr, paths.assignmentA), { title: "Assignment 2 (revised)" }));
    await assertSucceeds(updateDoc(doc(cr, paths.assignmentA), { active: false }));
    await assertSucceeds(deleteDoc(doc(cr, "classes/ece-2026-a/assignments/new")));
  });

  it("may not post as someone else", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    // createdBy is what makes postedByName trustworthy to students.
    await assertFails(
      setDoc(doc(cr, "classes/ece-2026-a/assignments/forged"), assignmentDoc({ createdBy: "cr-b-uid" })),
    );
  });

  it("cannot escalate its own role, class or active flag", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertFails(updateDoc(doc(cr, paths.userCrA), { role: "superadmin" }));
    await assertFails(updateDoc(doc(cr, paths.userCrA), { classId: "cse-2026-a" }));
    await assertFails(updateDoc(doc(cr, paths.userCrA), { active: false }));
  });

  it("may edit only its display name on its own profile", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertSucceeds(updateDoc(doc(cr, paths.userCrA), { displayName: "Asha R." }));
    await assertFails(updateDoc(doc(cr, paths.userCrA), { email: "attacker@evil.test" }));
  });

  it("cannot read other users' profiles", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertFails(getDoc(doc(cr, paths.userCrB)));
    await assertFails(getDoc(doc(cr, paths.userAdmin)));
    await assertFails(getDocs(collection(cr, "users")));
  });

  it("a deactivated CR is locked out immediately", async () => {
    await seedWorld(env);
    await put(env, paths.userCrA, userDoc({ active: false }));

    const cr = revokedCr(env);

    await assertFails(setDoc(doc(cr, "classes/ece-2026-a/assignments/x"), assignmentDoc()));
    await assertFails(updateDoc(doc(cr, paths.assignmentA), { title: "hacked" }));
    await assertFails(deleteDoc(doc(cr, paths.assignmentA)));
  });

  it("cannot create users or invites", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertFails(setDoc(doc(cr, "users/mallory-uid"), userDoc({ role: "superadmin" })));
    await assertFails(setDoc(doc(cr, "crInvites/mine"), inviteDoc()));
  });
});

describe("invites", () => {
  it("a superadmin can issue an invite", async () => {
    await seedWorld(env);
    await assertSucceeds(setDoc(doc(superadmin(env), "crInvites/tok-1"), inviteDoc()));
  });

  it("an invite can only ever mint a CR", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: true, usedBy: "cr-a2-uid" }));

    const cr2 = crOfA2(env);

    // The critical assertion: the role is pinned in the rule, not the request.
    await assertFails(
      setDoc(doc(cr2, paths.userCrA2), userDoc({ role: "superadmin", inviteToken: "tok-1" })),
    );
    await assertFails(
      setDoc(doc(cr2, "users/someone-else"), userDoc({ role: "superadmin", inviteToken: "tok-1" })),
    );
  });

  it("an invite grants only the class it was issued for", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: true, usedBy: "cr-a2-uid" }));

    const cr2 = crOfA2(env);

    await assertFails(
      setDoc(doc(cr2, "users/cr-a2-uid"), userDoc({ classId: "cse-2026-a", inviteToken: "tok-1" })),
    );
  });

  it("an unconsumed or unexpired invite does not grant anything", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    const cr2 = crOfA2(env);

    // Not consumed, so no role doc may be created from it.
    await assertFails(setDoc(doc(cr2, "users/cr-a2-uid"), userDoc({ inviteToken: "tok-1" })));
  });

  it("an expired invite cannot be consumed", async () => {
    await seedWorld(env);
    await put(env, paths.inviteExpired, inviteDoc({ expiresAt: ts(-1 * HOUR) }));

    const cr2 = crOfA2(env);

    await assertFails(updateDoc(doc(cr2, paths.inviteExpired), { used: true, usedBy: "cr-a2-uid" }));
  });

  it("an invite is single use", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: true, usedBy: "cr-a2-uid" }));

    const cr2 = crOfA2(env);

    // Already consumed, and a second claimant tries to take it.
    await assertFails(updateDoc(doc(cr2, paths.invite), { used: true, usedBy: "cr-b-uid" }));
  });

  it("consuming an invite may change nothing but used and usedBy", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc());

    const cr2 = crOfA2(env);

    await assertFails(updateDoc(doc(cr2, paths.invite), { classId: "cse-2026-a" }));
    await assertFails(updateDoc(doc(cr2, paths.invite), { used: true, usedBy: "cr-a2-uid", expiresAt: ts(999 * HOUR) }));
    await assertSucceeds(updateDoc(doc(cr2, paths.invite), { used: true, usedBy: "cr-a2-uid" }));
  });

  it("invite tokens cannot be probed or listed", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc());

    const cr2 = crOfA2(env);
    const anon = env.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(cr2, paths.invite)));
    await assertFails(getDoc(doc(anon, paths.invite)));
    await assertFails(getDocs(collection(cr2, "crInvites")));
  });
});

describe("CR transfer", () => {
  it("the incoming CR can revoke the outgoing CR, and only the active flag", async () => {
    await seedWorld(env);
    await seedConsumedTransferInvite(env);

    const cr2 = crOfA2(env);

    await assertSucceeds(
      updateDoc(doc(cr2, paths.userCrA), { active: false, revokeToken: "tok-1" }),
    );
  });

  it("the incoming CR cannot use a transfer invite to rewrite a role or class", async () => {
    await seedWorld(env);
    await seedConsumedTransferInvite(env);

    const cr2 = crOfA2(env);

    await assertFails(updateDoc(doc(cr2, paths.userCrA), { role: "superadmin", revokeToken: "tok-1" }));
    await assertFails(updateDoc(doc(cr2, paths.userCrA), { classId: "cse-2026-a", revokeToken: "tok-1" }));
    await assertFails(updateDoc(doc(cr2, paths.userCrB), { active: false, revokeToken: "tok-1" }));
  });

  it("an unrelated CR cannot revoke anybody", async () => {
    await seedWorld(env);
    await seedConsumedTransferInvite(env);

    const crB = crOfB(env);

    await assertFails(updateDoc(doc(crB, paths.userCrA), { active: false, revokeToken: "tok-1" }));
  });
});

describe("superadmin", () => {
  it("manages classes, subjects and assignments across classes", async () => {
    await seedWorld(env);
    const admin = superadmin(env);

    await assertSucceeds(setDoc(doc(admin, "classes/new-2027-b"), classDoc({ active: false })));
    await assertSucceeds(setDoc(doc(admin, "classes/cse-2026-a/subjects/os2"), subjectDoc()));
    await assertSucceeds(
      setDoc(doc(admin, "classes/cse-2026-a/assignments/b2"), assignmentDoc({ createdBy: "admin-uid" })),
    );
    await assertSucceeds(updateDoc(doc(admin, paths.assignmentB), { title: "corrected" }));
    await assertSucceeds(deleteDoc(doc(admin, paths.assignmentB)));
  });

  it("reads and writes any user profile", async () => {
    await seedWorld(env);
    const admin = superadmin(env);

    await assertSucceeds(getDoc(doc(admin, paths.userCrA)));
    await assertSucceeds(getDocs(collection(admin, "users")));
    await assertSucceeds(updateDoc(doc(admin, paths.userCrA), { active: false }));
    await assertSucceeds(deleteDoc(doc(admin, paths.userCrA)));
  });

  it("revokes an invite it has issued", async () => {
    await seedWorld(env);
    const admin = superadmin(env);

    await assertSucceeds(setDoc(doc(admin, "crInvites/tok-9"), inviteDoc()));
    await assertSucceeds(deleteDoc(doc(admin, "crInvites/tok-9")));
  });
});

describe("public document hygiene", () => {
  it("accepts a deliberate contactEmail on an assignment", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    await assertSucceeds(
      setDoc(
        doc(cr, "classes/ece-2026-a/assignments/with-contact"),
        assignmentDoc({ contactEmail: "professor@college.edu" }),
      ),
    );
  });

  it("rejects a denormalised account email", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    // The dangerous names are absent from the allow-list, so the write fails.
    await assertFails(
      setDoc(doc(cr, "classes/ece-2026-a/assignments/leak"), assignmentDoc({ postedByEmail: "cr@example.edu" })),
    );
    await assertFails(
      setDoc(doc(cr, "classes/ece-2026-a/assignments/leak2"), assignmentDoc({ crEmail: "cr@example.edu" })),
    );
  });

  it("rejects unexpected fields on classes and subjects", async () => {
    await seedWorld(env);
    const admin = superadmin(env);

    await assertFails(setDoc(doc(admin, "classes/sloppy"), classDoc({ ownerEmail: "x@y.z" })));
    await assertFails(setDoc(doc(admin, "classes/ece-2026-a/subjects/sloppy"), subjectDoc({ hidden: true })));
  });
});
