/**
 * Login.js
 * Componente de Autenticação para o Kanbada.
 * Versão Melhorada: Separação clara de Login/Cadastro, multi-usuário, SHA-256.
 */

let loginMode = 'login'; // 'login' | 'register'

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
    try { return JSON.parse(localStorage.getItem('kanbada_users') || '{}'); }
    catch { return {}; }
}

function saveUsers(users) {
    localStorage.setItem('kanbada_users', JSON.stringify(users));
}

window.renderLogin = function() {
    const loginRoot = document.getElementById('login-root');
    if (!loginRoot) return;
    const isLogin = loginMode === 'login';

    loginRoot.innerHTML = `
        <div class="login-screen fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div class="login-card w-full max-w-md rounded-[24px] p-8 space-y-5">
                <div class="text-center space-y-2">
                    <div class="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#FF6B8A] to-[#FF8E53] mb-2">
                        <i data-lucide="layers" class="text-white w-8 h-8"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-white">Kanbada</h1>
                    <p class="text-gray-400 text-sm">${isLogin ? 'Entre na sua conta para continuar' : 'Crie sua conta gratuita'}</p>
                </div>

                <div class="flex rounded-xl overflow-hidden border border-[#2a2a44]">
                    <button type="button" onclick="window.switchLoginMode('login')"
                        class="flex-1 py-2.5 text-sm font-semibold transition-all ${isLogin ? 'bg-[#FF6B8A] text-white' : 'bg-transparent text-gray-400 hover:text-gray-200'}">
                        Entrar
                    </button>
                    <button type="button" onclick="window.switchLoginMode('register')"
                        class="flex-1 py-2.5 text-sm font-semibold transition-all ${!isLogin ? 'bg-[#FF6B8A] text-white' : 'bg-transparent text-gray-400 hover:text-gray-200'}">
                        Criar Conta
                    </button>
                </div>

                <form id="auth-form" onsubmit="window.handleAuth(event)" class="space-y-4">
                    ${!isLogin ? `
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                        <input id="auth-name" type="text" required minlength="3"
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none"
                            placeholder="Ex: Ana Silva" autocomplete="name">
                    </div>` : ''}

                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                        <input id="auth-email" type="email" required
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none"
                            placeholder="ana@exemplo.com" autocomplete="email">
                    </div>

                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Senha</label>
                        <div class="relative">
                            <input id="auth-pass" type="password" required minlength="6"
                                class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none pr-12"
                                placeholder="••••••••" autocomplete="${isLogin ? 'current-password' : 'new-password'}">
                            <button type="button" onclick="window.togglePasswordVisibility('auth-pass','auth-eye')"
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1">
                                <i id="auth-eye" data-lucide="eye" class="w-5 h-5"></i>
                            </button>
                        </div>
                        ${!isLogin ? `<p class="text-[10px] text-gray-500 mt-1">Mínimo 6 caracteres</p>` : ''}
                    </div>

                    ${!isLogin ? `
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirmar Senha</label>
                        <div class="relative">
                            <input id="auth-pass2" type="password" required minlength="6"
                                class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none pr-12"
                                placeholder="••••••••" autocomplete="new-password">
                            <button type="button" onclick="window.togglePasswordVisibility('auth-pass2','auth-eye2')"
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1">
                                <i id="auth-eye2" data-lucide="eye" class="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>` : ''}

                    <div id="auth-error" class="hidden text-xs text-[#FF6B8A] bg-[#FF6B8A]/10 border border-[#FF6B8A]/20 rounded-lg p-2.5"></div>

                    <button type="submit" id="auth-submit-btn"
                        class="w-full py-4 bg-gradient-to-r from-[#FF6B8A] to-[#FF8E53] text-white font-bold rounded-xl shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                        <span id="auth-btn-text">${isLogin ? 'Entrar no App' : 'Criar Conta'}</span>
                    </button>
                </form>

                ${isLogin ? `
                <p class="text-center text-[11px] text-gray-500">
                    <button onclick="window.forgotPassword()" class="underline hover:text-gray-300 transition-colors">
                        Esqueceu a senha?
                    </button>
                </p>` : ''}

                <p class="text-center text-[10px] text-gray-600">
                    Dados salvos localmente neste navegador. Nenhuma informação é enviada para servidores externos.
                </p>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ scope: loginRoot });
    setTimeout(() => { const f = loginRoot.querySelector('input'); if (f) f.focus(); }, 50);
};

window.switchLoginMode = function(mode) {
    loginMode = mode;
    window.renderLogin();
};

window.togglePasswordVisibility = function(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
    if (window.lucide) window.lucide.createIcons({ scope: icon.parentElement });
};

window.handleAuth = async function(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');
    const btnText = document.getElementById('auth-btn-text');

    errorDiv.classList.add('hidden');
    submitBtn.disabled = true;
    btnText.textContent = 'Aguarde...';

    const email = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-pass').value;

    try {
        if (loginMode === 'login') {
            await handleLoginFlow(email, password, errorDiv);
        } else {
            await handleRegisterFlow(email, password, errorDiv);
        }
    } catch (err) {
        showAuthError(errorDiv, 'Erro inesperado. Tente novamente.');
        console.error('Auth error:', err);
    } finally {
        submitBtn.disabled = false;
        btnText.textContent = loginMode === 'login' ? 'Entrar no App' : 'Criar Conta';
    }
};

async function handleLoginFlow(email, password, errorDiv) {
    const users = getUsers();

    // Compatibilidade com conta única antiga (kanbada_user com passwordHash Base64)
    const oldUser = (() => {
        try { return JSON.parse(localStorage.getItem('kanbada_user') || 'null'); } catch { return null; }
    })();

    let user = users[email];

    // Migração de conta antiga para novo sistema multi-usuário
    if (!user && oldUser && oldUser.email === email && oldUser.passwordHash) {
        // Conta antiga usa btoa(), nova usa SHA-256. Não podemos comparar diretamente.
        // Solicitamos nova senha ou aceitamos btoa por compatibilidade uma vez.
        const legacyHash = btoa(password);
        if (oldUser.passwordHash === legacyHash) {
            // Migra: salva no novo formato com SHA-256
            const newHash = await hashPassword(password);
            const migratedUser = { ...oldUser, passwordHash: newHash };
            users[email] = migratedUser;
            saveUsers(users);
            user = migratedUser;
        }
    }

    if (!user) {
        showAuthError(errorDiv, 'Email não encontrado. Verifique ou crie uma conta.');
        return;
    }

    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
        showAuthError(errorDiv, 'Senha incorreta. Tente novamente.');
        return;
    }

    const sessionUser = { ...user, lastLogin: new Date().toISOString() };
    delete sessionUser.passwordHash;
    localStorage.setItem('kanbada_user', JSON.stringify(sessionUser));

    users[email].lastLogin = sessionUser.lastLogin;
    saveUsers(users);

    if (window.onLoginSuccess) window.onLoginSuccess(sessionUser);
}

async function handleRegisterFlow(email, password, errorDiv) {
    const name = document.getElementById('auth-name').value.trim();
    const pass2 = document.getElementById('auth-pass2').value;

    if (name.length < 3) { showAuthError(errorDiv, 'Nome deve ter no mínimo 3 caracteres.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuthError(errorDiv, 'Email inválido.'); return; }
    if (password.length < 6) { showAuthError(errorDiv, 'Senha deve ter no mínimo 6 caracteres.'); return; }
    if (password !== pass2) { showAuthError(errorDiv, 'As senhas não coincidem.'); return; }

    const users = getUsers();
    if (users[email]) { showAuthError(errorDiv, 'Este email já está cadastrado. Faça login.'); return; }

    const passwordHash = await hashPassword(password);
    const newUser = {
        name,
        email,
        passwordHash,
        initials: name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
    };

    users[email] = newUser;
    saveUsers(users);

    const sessionUser = { ...newUser };
    delete sessionUser.passwordHash;
    localStorage.setItem('kanbada_user', JSON.stringify(sessionUser));

    if (window.onLoginSuccess) window.onLoginSuccess(sessionUser);
}

window.forgotPassword = async function() {
    const emailInput = await window.customPrompt('Recuperar Senha', 'Digite o email cadastrado:');
    if (!emailInput) return;
    const email = emailInput.trim().toLowerCase();
    const users = getUsers();
    if (!users[email]) {
        window.showToast('Email não encontrado.', 'error');
        return;
    }
    
    if (!(await window.customConfirm('Redefinir Senha', `Deseja realmente redefinir a senha para "${email}"? Suas tarefas serão mantidas.`))) return;
    
    const newPass = await window.customPrompt('Nova Senha', 'Digite a nova senha (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) {
        window.showToast('Senha inválida. Operação cancelada.', 'error');
        return;
    }
    
    const hash = await hashPassword(newPass);
    users[email].passwordHash = hash;
    saveUsers(users);
    window.showToast('Senha redefinida com sucesso! Faça o login.');
};

function showAuthError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    errorDiv.style.animation = 'none';
    void errorDiv.offsetWidth;
    errorDiv.style.animation = 'shake 0.4s ease';
}

(function injectShakeCSS() {
    if (document.getElementById('kanbada-shake-css')) return;
    const style = document.createElement('style');
    style.id = 'kanbada-shake-css';
    style.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`;
    document.head.appendChild(style);
})();
