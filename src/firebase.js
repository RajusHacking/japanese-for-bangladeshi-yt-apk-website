import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCJwAufH4y3HIcn1vUTuzuD-Vii2Pnbc2k",
  authDomain: "japanese-for-bangladeshi.firebaseapp.com",
  projectId: "japanese-for-bangladeshi",
  storageBucket: "japanese-for-bangladeshi.firebasestorage.app",
  messagingSenderId: "1004654262430",
  appId: "1:1004654262430:web:b54ca8e3273e779bbc238f",
  measurementId: "G-969FDVER69"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
