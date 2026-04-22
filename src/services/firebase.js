import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTV-UqLzI0yowiMqCTcMqY1hZxKsXduZ4",
  authDomain: "kanbada-2150a.firebaseapp.com",
  projectId: "kanbada-2150a",
  storageBucket: "kanbada-2150a.firebasestorage.app",
  messagingSenderId: "842982188246",
  appId: "1:842982188246:web:820dd5d6c519bdf97a9577",
  measurementId: "G-8CRVWKS2G8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
