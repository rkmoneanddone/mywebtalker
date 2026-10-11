import {initializeApp,getApps,getApp} from "firebase/app";
import {getAuth} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

/** Firebase client identifiers are public configuration, never backend secrets. */
const config={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyALWTy_IDa_BbalQqwjZCgdiDiN0MtHs-A",
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "zero2hello-5034e.firebaseapp.com",
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID || "zero2hello-5034e",
 storageBucket:"zero2hello-5034e.firebasestorage.app",
 messagingSenderId:"52738488416",
 appId:import.meta.env.VITE_FIREBASE_APP_ID || "1:52738488416:web:7ca95c9d423277730dab05",
 measurementId:"G-4PWJTNQ4JG"
};
/** Reuse an existing app instance to support hot module reloads. */
export const configured=Boolean(config.apiKey&&config.projectId&&config.appId);
export const app=configured?(getApps().length?getApp():initializeApp(config)):null;
/** Authentication and restricted tenant database clients. */
export const auth=app?getAuth(app):null;
export const db=app?getFirestore(app):null;
