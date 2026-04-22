/**
 * auth.service.js
 * Serviço de autenticação usando Firebase Compat (Global).
 */

window.authService = {
    // Cadastro
    async register(name, email, password) {
        const cred = await window.auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({
            displayName: name,
            photoURL: name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        });
        return cred.user;
    },

    // Login
    async login(email, password) {
        const cred = await window.auth.signInWithEmailAndPassword(email, password);
        return cred.user;
    },

    // Logout
    async logout() { 
        return window.auth.signOut(); 
    },

    // Resetar senha por email real
    async resetPassword(email) {
        return window.auth.sendPasswordResetEmail(email);
    },

    // Observer de sessão — chama callback com user ou null
    onAuthChange(callback) {
        return window.auth.onAuthStateChanged(callback);
    }
};
