import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDNaL89s_SboPpSY02ioaHexYUf1Xf1QvE",
  authDomain: "mardelux-app.firebaseapp.com",
  projectId: "mardelux-app",
  storageBucket: "mardelux-app.firebasestorage.app",
  messagingSenderId: "440285677582",
  appId: "1:440285677582:web:54f863260c74cbd39a145f",
  measurementId: "G-LYHW7PNT8Y",
};

// Inicializar Firebase (apenas uma vez)
const app: FirebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

/** Analytics só está disponível no browser (evita erro em SSR) */
export function getAnalyticsSafe(): Analytics | null {
  if (typeof window === "undefined") return null;
  return getAnalytics(app);
}

export { app };
export default app;
