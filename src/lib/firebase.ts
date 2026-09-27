/**
 * Firebase initialisation.
 *
 * The values below are Firebase *web app* config. They are public by design:
 * every one of them ships in the browser bundle, which is why they can be
 * committed. They identify the project; they do not grant access to it. The
 * actual boundary is `firestore.rules` and `storage.rules`.
 *
 * To point this at a different project, change these values — or better, copy
 * them from Firebase console → Project settings → Your apps.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

export const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
