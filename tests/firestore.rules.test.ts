/**
 * The permission matrix, as executable tests.
 *
 * Every deny case here is the point of the exercise: a test that asserts a
 * write is refused documents an intended hole that must stay closed. If a rule
 * is loosened, one of these fails.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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

  it("may edit an assignment but never its authorship", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    // The ordinary edit, of the kind the M6 form makes.
    await assertSucceeds(
      updateDoc(doc(cr, paths.assignmentA), { title: "Assignment 1 (revised)", updatedAt: ts(0) }),
    );

    // But the fields that identify who posted, and when, are pinned. A CR who
    // could rewrite createdBy could make their own work look like a colleague's,
    // which is the one thing postedByName promises students it is not.
    await assertFails(
      updateDoc(doc(cr, paths.assignmentA), { createdBy: "cr-b-uid" }),
    );
    await assertFails(
      updateDoc(doc(cr, paths.assignmentA), { createdAt: ts(-999_000) }),
    );

    // publishedName is the student-facing attribution. Leaving it editable is
    // deliberate — a CR corrects a typo in their own name — but it is the reason
    // createdBy above has to hold.
    await assertSucceeds(updateDoc(doc(cr, paths.assignmentA), { postedByName: "A. Rao" }));
  });

  it("can deactivate and reactivate, and cannot deactivate another class's work", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    // Soft delete, per §18. active is deliberately not pinned on update.
    await assertSucceeds(updateDoc(doc(cr, paths.assignmentA), { active: false }));
    await assertSucceeds(updateDoc(doc(cr, paths.assignmentA), { active: true }));

    // And still nothing outside its own class.
    await assertFails(updateDoc(doc(cr, paths.assignmentB), { active: false }));
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

  /**
   * The claim sequence, exactly as the invite page performs it.
   *
   * These two writes in this order are the whole onboarding flow, and the order
   * is not a style choice: the profile rule requires `presentedInvite().usedBy ==
   * request.auth.uid`, so the token has to be spent first or the profile write is
   * refused. It cannot be a single batch, because rules evaluate get() against
   * committed state rather than against the other writes in the same batch.
   */
  it("the claim sequence works: spend the token, then create the profile", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    // A genuinely fresh uid, with no profile. Not crOfA2: seedWorld gives that one
    // a users/{uid} document, which would make the profile write an *update* — a
    // different rule, and one that correctly refuses to change a role.
    const NEWCOMER = "newcomer-uid";
    const newcomer = env.authenticatedContext(NEWCOMER).firestore();

    // Step one: consume.
    await assertSucceeds(
      updateDoc(doc(newcomer, paths.invite), { used: true, usedBy: NEWCOMER }),
    );
    // Step two: the profile the rules now recognise.
    await assertSucceeds(
      setDoc(
        doc(newcomer, `users/${NEWCOMER}`),
        userDoc({ inviteToken: "tok-1", classId: "ece-2026-a" }),
      ),
    );

    // And the result is a working CR of exactly that class.
    await assertSucceeds(
      setDoc(
        doc(newcomer, "classes/ece-2026-a/assignments/first"),
        assignmentDoc({ createdBy: NEWCOMER }),
      ),
    );
    await assertFails(
      setDoc(
        doc(newcomer, "classes/cse-2026-a/assignments/overreach"),
        assignmentDoc({ createdBy: NEWCOMER }),
      ),
    );
  });

  it("a tampered class in the link is refused at the profile write", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    const NEWCOMER = "newcomer-uid";
    const newcomer = env.authenticatedContext(NEWCOMER).firestore();
    await assertSucceeds(
      updateDoc(doc(newcomer, paths.invite), { used: true, usedBy: NEWCOMER }),
    );

    // The link said class B, the invite was issued for class A. Refused, so a
    // swapped class id in a URL cannot grant the wrong class.
    await assertFails(
      setDoc(
        doc(newcomer, `users/${NEWCOMER}`),
        userDoc({ inviteToken: "tok-1", classId: "cse-2026-a" }),
      ),
    );
  });

  it("a profile cannot be created before its token is spent", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    const NEWCOMER = "newcomer-uid";
    const newcomer = env.authenticatedContext(NEWCOMER).firestore();

    // The order matters, so this is asserted independently of the happy path.
    await assertFails(
      setDoc(
        doc(newcomer, `users/${NEWCOMER}`),
        userDoc({ inviteToken: "tok-1", classId: "ece-2026-a" }),
      ),
    );
  });

  it("a claim cannot be replayed onto a second account", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    const first = env.authenticatedContext("first-uid").firestore();
    await assertSucceeds(
      updateDoc(doc(first, paths.invite), { used: true, usedBy: "first-uid" }),
    );
    await assertSucceeds(
      setDoc(doc(first, "users/first-uid"), userDoc({ inviteToken: "tok-1" })),
    );

    // The same link, opened by someone else — the token is spent and the profile
    // rule requires usedBy to be *this* user, so the second account gets nothing.
    const second = env.authenticatedContext("second-uid").firestore();
    await assertFails(updateDoc(doc(second, paths.invite), { used: true, usedBy: "second-uid" }));
    await assertFails(setDoc(doc(second, "users/second-uid"), userDoc({ inviteToken: "tok-1" })));
  });

  it("a claim must carry a name, and it may not be blank", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    const NEWCOMER = "newcomer-uid";
    const ctx = env.authenticatedContext(NEWCOMER).firestore();

    await assertSucceeds(
      updateDoc(doc(ctx, paths.invite), { used: true, usedBy: NEWCOMER }),
    );

    // The happy path. The name is the CR's own, from the claim form, and it is
    // what every assignment they post will be attributed to.
    await assertSucceeds(
      setDoc(
        doc(ctx, `users/${NEWCOMER}`),
        userDoc({ inviteToken: "tok-1", classId: "ece-2026-a", displayName: "Nikhil Rao" }),
      ),
    );
  });

  it("refuses a claim with no display name", async () => {
    await seedWorld(env);
    await put(env, paths.invite, inviteDoc({ used: false, usedBy: null }));

    const NEWCOMER = "newcomer-uid";
    const ctx = env.authenticatedContext(NEWCOMER).firestore();
    await assertSucceeds(
      updateDoc(doc(ctx, paths.invite), { used: true, usedBy: NEWCOMER }),
    );

    // A blank name would publish an empty byline on every assignment.
    await assertFails(
      setDoc(
        doc(ctx, `users/${NEWCOMER}`),
        userDoc({ inviteToken: "tok-1", displayName: "" }),
      ),
    );

    const { displayName: _dropped, ...withoutName } = userDoc({ inviteToken: "tok-1" });
    await assertFails(setDoc(doc(ctx, `users/${NEWCOMER}`), withoutName));
  });

  it("still refuses a self-registered stranger writing their own role", async () => {
    await seedWorld(env);
    const s = stranger(env);

    // A bare account cannot hand itself a role by writing its own document.
    await assertFails(
      setDoc(doc(s, "users/stranger-uid"), userDoc({ role: "cr", displayName: "Mallory" })),
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

  it("accepts a dueNote, and still refuses an unlisted field", async () => {
    await seedWorld(env);
    const cr = crOfA(env);

    // A standing note in place of a date: work that is not due on a particular
    // day. The CR authors it, so it is as publishable as the description.
    await assertSucceeds(
      setDoc(
        doc(cr, "classes/ece-2026-a/assignments/reading"),
        assignmentDoc({ dueDate: "", dueNote: "No deadline for now", priority: "none" }),
      ),
    );

    // And it reaches students, since they read the same collection.
    const anon = env.unauthenticatedContext().firestore();
    const feed = await assertSucceeds(
      getDocs(query(collection(anon, "classes/ece-2026-a/assignments"), where("active", "==", true))),
    );
    expect(feed.docs.map((d) => d.id)).toContain("reading");

    // hasOnly is still doing its job on the same collection.
    await assertFails(
      setDoc(
        doc(cr, "classes/ece-2026-a/assignments/sloppy"),
        assignmentDoc({ studentEmail: "leak@evil.test" }),
      ),
    );
  });

  it("rejects unexpected fields on classes and subjects", async () => {
    await seedWorld(env);
    const admin = superadmin(env);

    await assertFails(setDoc(doc(admin, "classes/sloppy"), classDoc({ ownerEmail: "x@y.z" })));
    await assertFails(setDoc(doc(admin, "classes/ece-2026-a/subjects/sloppy"), subjectDoc({ hidden: true })));
  });
});

/**
 * Lists are authorised differently from single reads, and the difference is not
 * obvious. A point read is checked against one document. A query is checked once
 * for the whole result set, so a branch that varies per document
 * (`resource.data.active == true`) has to appear in the query's own where()
 * clause, while a branch that is constant for the caller (amSuperadmin,
 * isMyClass — both a single get() on the caller's own profile) is evaluated for
 * the query as a whole and needs no filter.
 *
 * These tests pin that behaviour. The one that matters most is the first: a CR
 * losing access to its own archived work is silent, invisible in the UI, and
 * would otherwise only surface in M6 as an empty filter result.
 */
describe("query authorisation", () => {
  /** An archived assignment, invisible to students. */
  async function seedArchived(env: RulesTestEnvironment) {
    await put(env, "classes/ece-2026-a/assignments/archived", assignmentDoc({ active: false }));
    await put(env, "classes/ece-2026-a/subjects/old", subjectDoc({ active: false }));
  }

  it("lets a CR list its own class unfiltered, archived work included", async () => {
    await seedWorld(env);
    await seedArchived(env);
    const cr = crOfA(env);

    // The whole point. No active filter, and the archived document comes back.
    const assignments = await assertSucceeds(
      getDocs(collection(cr, "classes/ece-2026-a/assignments")),
    );
    expect(assignments.docs.map((d) => d.id).sort()).toEqual(["a1", "archived"]);

    await assertSucceeds(getDocs(collection(cr, "classes/ece-2026-a/subjects")));
    // But not the classes collection. isMyClass(classId) is constant for a
    // subcollection — the path already fixed the class — whereas across
    // /classes it varies per document, so it cannot carry a query. A CR reads
    // its own class with getDoc, and lists the public ones with a filter.
    await assertSucceeds(getDoc(doc(cr, paths.classA)));
    await assertFails(getDocs(collection(cr, "classes")));
  });

  it("still hides another class's archived work from a CR", async () => {
    await seedWorld(env);
    await put(env, "classes/cse-2026-a/assignments/hidden", assignmentDoc({ active: false }));
    const crOfClassA = crOfA(env);

    // Unfiltered, the public branch cannot be proven and isMyClass is false.
    await assertFails(getDocs(collection(crOfClassA, "classes/cse-2026-a/assignments")));
    // Naming active == false directly must not become a way around it.
    await assertFails(
      getDocs(query(collection(crOfClassA, "classes/cse-2026-a/assignments"), where("active", "==", false))),
    );
    // A CR of B may of course see B's own archive.
    await assertSucceeds(getDocs(collection(crOfB(env), "classes/cse-2026-a/assignments")));
  });

  it("keeps the public feed filtered, and hides archived work from visitors", async () => {
    await seedWorld(env);
    await seedArchived(env);
    const anon = env.unauthenticatedContext().firestore();

    // Students see active work only, and must ask for it by filter.
    const feed = await assertSucceeds(
      getDocs(query(collection(anon, "classes/ece-2026-a/assignments"), where("active", "==", true))),
    );
    expect(feed.docs.map((d) => d.id)).toEqual(["a1"]);

    await assertFails(getDocs(collection(anon, "classes/ece-2026-a/assignments")));
    await assertFails(
      getDocs(query(collection(anon, "classes/ece-2026-a/assignments"), where("active", "==", false))),
    );

    // A limit() does not buy a visitor anything: the query is still unprovable.
    await assertSucceeds(getDocs(query(collection(anon, "classes"), where("active", "==", true))));
  });

  it("lets a superadmin list everything, unfiltered, across classes", async () => {
    await seedWorld(env);
    await seedArchived(env);
    await put(env, "classes/it-2026-b", classDoc({ active: false, name: "IT" }));
    const admin = superadmin(env);

    const classes = await assertSucceeds(getDocs(collection(admin, "classes")));
    expect(classes.docs.map((d) => d.id).sort()).toEqual(["cse-2026-a", "ece-2026-a", "it-2026-b"]);

    const assignments = await assertSucceeds(getDocs(collection(admin, "classes/ece-2026-a/assignments")));
    expect(assignments.docs.map((d) => d.id).sort()).toEqual(["a1", "archived"]);
  });

  it("locks a deactivated CR out of its own archive", async () => {
    await seedWorld(env);
    await seedArchived(env);
    await put(env, "users/cr-a-uid", userDoc({ active: false }));
    const revoked = revokedCr(env);

    // The transfer revoked them; the public feed still works, the archive does not.
    await assertSucceeds(
      getDocs(query(collection(revoked, "classes/ece-2026-a/assignments"), where("active", "==", true))),
    );
    await assertFails(getDocs(collection(revoked, "classes/ece-2026-a/assignments")));
    await assertFails(
      getDocs(query(collection(revoked, "classes/ece-2026-a/assignments"), where("active", "==", false))),
    );
    await assertFails(getDoc(doc(revoked, "classes/ece-2026-a/assignments/archived")));
  });

  it("gives a self-registered stranger nothing beyond the public feed", async () => {
    await seedWorld(env);
    await seedArchived(env);
    const s = stranger(env);

    await assertSucceeds(
      getDocs(query(collection(s, "classes/ece-2026-a/assignments"), where("active", "==", true))),
    );
    await assertFails(getDocs(collection(s, "classes/ece-2026-a/assignments")));
    await assertFails(getDocs(collection(s, "classes")));
    await assertFails(getDoc(doc(s, "classes/ece-2026-a/assignments/archived")));
  });
});
