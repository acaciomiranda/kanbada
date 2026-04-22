import { authService } from '../services/auth.service.js';
import { dbService } from '../services/db.service.js';

window.renderLogin = function() {
    const root = document.getElementById('login-root');
    if (!root) return;

    root.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-6 bg-[#12121f]">
            <div class="w-full max-w-md bg-[#1e1e36] rounded-[32px] border border-[#2a2a44] shadow-2xl p-10 animate-zoom-in">
                <div class="flex flex-col items-center mb-8">
                    <div class="w-16 h-16 bg-gradient-to-tr from-[#FF6B8A] to-[#FF8E53] rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-pink-500/20">
                        <i data-lucide="layers" class="w-10 h-10 text-white"></i>
                    </div>
                    <h1 class="text-3xl font-extrabold text-white tracking-tight">Bem-vindo</h1>
                    <p class="text-gray-500 text-sm mt-2 text-center">Faça login para gerenciar suas tarefas na nuvem</p>
                </div>

                <form id="login-form" class="space-y-5">
                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
                        <div class="relative">
                            <i data-lucide="mail" class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                            <input type="email" id="l-email" required placeholder="seu@email.com"
                                class="w-full bg-[#12121f] border border-[#2a2a44] rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-[#FF6B8A] transition-all text-sm text-white">
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Senha</label>
                        <div class="relative">
                            <i data-lucide="lock" class="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                            <input type="password" id="l-pass" required placeholder="••••••••"
                                class="w-full bg-[#12121f] border border-[#2a2a44] rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:border-[#FF6B8A] transition-all text-sm text-white">
                        </div>
                    </div>

                    <div id="login-error" class="text-xs text-[#FF6B8A] font-bold text-center hidden"></div>

                    <button type="submit" id="btn-login" class="w-full bg-gradient-to-r from-[#FF6B8A] to-[#FF8E53] hover:scale-[1.02] text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg shadow-pink-500/20 active:scale-95 mt-4">
                        Entrar no Kanbada
                    </button>
                    
                    <button type="button" id="btn-forgot" class="w-full text-xs font-bold text-gray-500 hover:text-white transition-colors">
                        Esqueci minha senha
                    </button>
                </form>

                <div class="mt-8 pt-8 border-t border-[#2a2a44] text-center">
                    <p class="text-sm text-gray-500">Não tem uma conta?</p>
                    <button id="btn-show-register" class="text-sm font-bold text-[#FF6B8A] hover:underline mt-1">Criar conta gratuita</button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ scope: root });
    setupLoginListeners();
};

function setupLoginListeners() {
    const form = document.getElementById('login-form');
    const btnRegister = document.getElementById('btn-show-register');
    const btnForgot = document.getElementById('btn-forgot');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('l-email').value;
        const pass = document.getElementById('l-pass').value;
        const errDiv = document.getElementById('login-error');
        
        try {
            errDiv.classList.add('hidden');
            const user = await authService.login(email, pass);
            if (window.onLoginSuccess) window.onLoginSuccess(user);
        } catch (err) {
            console.error("Login Error:", err);
            if (err.code === 'auth/invalid-credential') {
                errDiv.textContent = 'E-mail ou senha incorretos.';
            } else if (err.code === 'auth/too-many-requests') {
                errDiv.textContent = 'Muitas tentativas. Tente mais tarde.';
            } else {
                errDiv.textContent = 'Erro de autenticação: ' + (err.message || 'Verifique sua conexão');
            }
            errDiv.classList.remove('hidden');
        }
    };

    btnRegister.onclick = renderRegister;
    btnForgot.onclick = async () => {
        const email = document.getElementById('l-email').value;
        if (!email) {
            alert('Digite seu e-mail primeiro.');
            return;
        }
        try {
            await authService.resetPassword(email);
            alert('E-mail de recuperação enviado!');
        } catch (err) {
            alert('Erro ao enviar e-mail.');
        }
    };
}

function renderRegister() {
    const root = document.getElementById('login-root');
    root.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-6 bg-[#12121f]">
            <div class="w-full max-w-md bg-[#1e1e36] rounded-[32px] border border-[#2a2a44] shadow-2xl p-10 animate-zoom-in">
                <div class="flex flex-col items-center mb-8">
                    <div class="w-16 h-16 bg-gradient-to-tr from-[#6C63FF] to-[#00C9A7] rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/20">
                        <i data-lucide="user-plus" class="w-10 h-10 text-white"></i>
                    </div>
                    <h1 class="text-3xl font-extrabold text-white tracking-tight">Criar Conta</h1>
                    <p class="text-gray-500 text-sm mt-2 text-center">Junte-se ao Kanbada e sincronize suas tarefas</p>
                </div>

                <form id="reg-form" class="space-y-5">
                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
                        <input type="text" id="r-name" required placeholder="Seu nome"
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-2xl px-4 py-3.5 outline-none focus:border-[#6C63FF] transition-all text-sm text-white">
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">E-mail</label>
                        <input type="email" id="r-email" required placeholder="seu@email.com"
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-2xl px-4 py-3.5 outline-none focus:border-[#6C63FF] transition-all text-sm text-white">
                    </div>

                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Senha (mín. 6 caracteres)</label>
                        <input type="password" id="r-pass" required minlength="6" placeholder="••••••••"
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-2xl px-4 py-3.5 outline-none focus:border-[#6C63FF] transition-all text-sm text-white">
                    </div>

                    <div id="reg-error" class="text-xs text-[#FF6B8A] font-bold text-center hidden"></div>

                    <button type="submit" class="w-full bg-gradient-to-r from-[#6C63FF] to-[#00C9A7] hover:scale-[1.02] text-white font-extrabold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 mt-4">
                        Criar minha conta
                    </button>
                </form>

                <div class="mt-8 pt-8 border-t border-[#2a2a44] text-center">
                    <button id="btn-show-login" class="text-sm font-bold text-gray-500 hover:text-white transition-colors underline">Já tenho uma conta</button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ scope: root });
    
    document.getElementById('reg-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('r-name').value;
        const email = document.getElementById('r-email').value;
        const pass = document.getElementById('r-pass').value;
        const errDiv = document.getElementById('reg-error');

        try {
            errDiv.classList.add('hidden');
            const user = await authService.register(name, email, pass);
            // Salva perfil inicial no Firestore
            await dbService.saveProfile(user.uid, {
                name: name,
                initials: name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
                email: email,
                createdAt: new Date().toISOString()
            });
            if (window.onLoginSuccess) window.onLoginSuccess(user);
        } catch (err) {
            console.error("Register Error:", err);
            if (err.code === 'auth/email-already-in-use') {
                errDiv.textContent = 'Este e-mail já está em uso.';
            } else if (err.code === 'auth/weak-password') {
                errDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.';
            } else if (err.code === 'auth/operation-not-allowed') {
                errDiv.textContent = 'Login por e-mail não habilitado no Firebase.';
            } else if (err.code === 'auth/unauthorized-domain') {
                errDiv.textContent = 'Este domínio não está autorizado no Firebase.';
            } else {
                errDiv.textContent = 'Erro ao criar conta: ' + (err.message || 'Tente novamente');
            }
            errDiv.classList.remove('hidden');
        }
    };

    document.getElementById('btn-show-login').onclick = window.renderLogin;
}
