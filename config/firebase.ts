import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import { Platform } from "react-native";

type FirebaseAuthNativeModule = {
  initializeAuth: (
    app: import("firebase/app").FirebaseApp,
    deps: {
      persistence: ReturnType<
        FirebaseAuthNativeModule["getReactNativePersistence"]
      >;
    },
  ) => Auth;
  getReactNativePersistence: (storage: {
    setItem: (k: string, v: string) => Promise<void>;
    getItem: (k: string) => Promise<string | null>;
    removeItem: (k: string) => Promise<void>;
  }) => unknown;
  getAuth: (app?: import("firebase/app").FirebaseApp) => Auth;
};

const firebaseConfig = {
  apiKey: "AIzaSyCXX8I21MDAN2bFbJ0jcTcagjpL8cxrq2g",
  authDomain: "cloud---homolog.firebaseapp.com",
  projectId: "cloud---homolog",
  storageBucket: "cloud---homolog.firebasestorage.app",
  messagingSenderId: "807635388333",
  appId: "1:807635388333:web:c200dab7ab043b50780324",
  measurementId: "G-2C5HN7VYD5",
};

const app = initializeApp(firebaseConfig);

function getAuthInstance(): Auth {
  if (Platform.OS === "web") {
    const { getAuth } =
      require("firebase/auth") as typeof import("firebase/auth");
    return getAuth(app);
  }

  const { initializeAuth, getReactNativePersistence, getAuth } =
    require("@firebase/auth") as FirebaseAuthNativeModule;

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw e;
  }
}

export const auth = getAuthInstance();
