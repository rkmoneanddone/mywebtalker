import {initializeApp,getApps,getApp} from "firebase/app";
import {getAuth} from "firebase/auth";
const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
export const configured=Boolean(config.apiKey&&config.projectId&&config.appId);
export const app=configured?(getApps().length?getApp():initializeApp(config)):null;
export const auth=app?getAuth(app):null;
