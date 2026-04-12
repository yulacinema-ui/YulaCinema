import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD-2n8UlUbuiD0SLNj0tLTjvVaIfaTY61g",
  authDomain: "yulacinema-ec8ef.firebaseapp.com",
  projectId: "yulacinema-ec8ef",
  databaseURL: "https://yulacinema-ec8ef-default-rtdb.firebaseio.com",
  storageBucket: "yulacinema-ec8ef.firebasestorage.app",
  messagingSenderId: "194720886903",
  appId: "1:194720886903:web:4c1015a88a0332698a5672"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);