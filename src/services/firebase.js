import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAoX9LYdQM0RM-SvXVWFidBkYdV0TTdpJ4",
    authDomain: "kanbada-2150a.firebaseapp.com",
    projectId: "kanbada-2150a",
    storageBucket: "kanbada-2150a.firebasestorage.app",
    messagingSenderId: "842982188246",
    appId: "1:842982188246:web:80a131da43a4138b7a9577",
    measurementId: "G-K86M9LGGZP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
