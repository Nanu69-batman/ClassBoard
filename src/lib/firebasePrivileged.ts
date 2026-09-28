/**
 * Firebase initialisation for the privileged surfaces only.
 *
 * Split from `firebase.ts` so that `firebase/auth` and `firebase/storage` are
 * only reachable from the `/cr` and `/admin` bundles, which are `React.lazy`
 * (see `src/App.tsx`). A student lands on `/` and downloads the Firestore SDK —
 * M4 puts real data on their dashboard — but not the auth or storage SDKs, which
 * their session cannot use.
 *
 * Both files initialise the same default app. `initializeApp` returns the
 * existing instance for a given name rather than creating a second one, so the
 * two modules share one app, one Firestore instance and one App Check
 * registration no matter which loads first.
 */

import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

import { firebaseApp } from "./firebase";

export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);
