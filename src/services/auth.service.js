import { auth } from './firebase.js?v=4';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export const authService = {
    // Cadastro
    async register(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, {
            displayName: name,
            photoURL: name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        });
        return cred.user;
    },

    // Login
    async login(email, password) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
    },

    // Logout
    async logout() { return signOut(auth); },

    // Resetar senha por email real
    async resetPassword(email) {
        return sendPasswordResetEmail(auth, email);
    },

    // Observer de sessão — chama callback com user ou null
    onAuthChange(callback) {
        return onAuthStateChanged(auth, callback);
    }
};
