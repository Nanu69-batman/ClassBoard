import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";

/** The `users/{uid}` document. The only authority on what a person may do. */
export type UserProfile = {
  role: "cr" | "superadmin";
  classId?: string;
  active: boolean;
  displayName?: string;
  email?: string;
};

export type AuthStatus = "loading" | "signed-out" | "signed-in";

type AuthValue = {
  status: AuthStatus;
  /** The Firebase identity, or null. */
  user: User | null;
  /** The `users/{uid}` document, or null when there is none. */
  profile: UserProfile | null;
  /**
   * True when signed in but holding no role at all — a self-registered account,
   * or a CR who has not claimed an invite yet. Such a person can read the
   * public feed and nothing else.
   */
  hasNoRole: boolean;
  isCr: boolean;
  isSuperadmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Stays "loading" until we know whether there is a profile, so a guard never
  // redirects on the strength of a null that has not loaded yet.
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setProfileChecked(true);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", nextUser.uid));
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
      } catch {
        // A read failure must not invent a role. Leave the profile null; the
        // guards then deny, which is the safe direction.
        setProfile(null);
      } finally {
        setProfileChecked(true);
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const createAccountWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthValue>(() => {
    const signedIn = user !== null;
    const role = profile?.role;

    return {
      status: !signedIn ? "signed-out" : profileChecked ? "signed-in" : "loading",
      user,
      profile,
      hasNoRole: signedIn && profileChecked && profile === null,
      isCr: role === "cr" && profile?.active === true,
      isSuperadmin: role === "superadmin" && profile?.active === true,
      signInWithGoogle,
      signInWithEmail,
      createAccountWithEmail,
      signOut,
    };
  }, [user, profile, profileChecked, signInWithGoogle, signInWithEmail, createAccountWithEmail, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
