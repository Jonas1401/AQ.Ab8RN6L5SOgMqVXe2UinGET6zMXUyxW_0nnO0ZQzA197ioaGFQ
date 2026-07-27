import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAHHTj07Yc4nABVWrcmDAdPFeKGv0EVcx0",
  authDomain: "porto-318bf.firebaseapp.com",
  projectId: "porto-318bf",
  storageBucket: "porto-318bf.firebasestorage.app",
  messagingSenderId: "172293883758",
  appId: "1:172293883758:web:422554b4f90290cb70e37f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
