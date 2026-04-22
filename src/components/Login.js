/**
 * Login.js
 * Componente de Autenticação para o Kanbada.
 * Versão Corrigida com Validação de Senha
 */

window.renderLogin = function() {
    const loginRoot = document.getElementById('login-root');
    if (!loginRoot) return;

    loginRoot.innerHTML = `
        <div class="login-screen fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div class="login-card w-full max-w-md rounded-[24px] p-8 space-y-6">
                <div class="text-center space-y-2">
                    <div class="inline-flex p-3 rounded-2xl bg-gradient-to-br from-[#FF6B8A] to-[#FF8E53] mb-2">
                        <i data-lucide="layers" class="text-white w-8 h-8"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-white">Bem-vindo ao Kanbada</h1>
                    <p class="text-gray-400 text-sm">Gerencie seus projetos com estilo</p>
                </div>

                <form onsubmit="window.handleLogin(event)" class="space-y-4">
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                        <input id="login-name" type="text" required 
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none transition-all"
                            placeholder="Ex: Ana Silva">
                    </div>
                    
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                        <input id="login-email" type="email" required 
                            class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none transition-all"
                            placeholder="ana@exemplo.com">
                    </div>
                    
                    <div class="space-y-1">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Senha</label>
                        <div class="relative">
                            <input id="login-pass" type="password" required 
                                class="w-full bg-[#12121f] border border-[#2a2a44] rounded-xl px-4 py-3 text-white focus:border-[#FF6B8A] outline-none transition-all pr-10"
                                placeholder="••••••••"
                                minlength="6">
                            <button type="button" onclick="window.togglePasswordVisibility()" 
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                                <i id="password-eye" data-lucide="eye" class="w-5 h-5"></i>
                            </button>
                        </div>
                        <p class="text-[10px] text-gray-500 mt-1">Mínimo 6 caracteres</p>
                    </div>

                    <div id="login-error" class="hidden text-xs text-[#FF6B8A] bg-[#FF6B8A]/10 border border-[#FF6B8A]/20 rounded-lg p-2.5"></div>

                    <button type="submit" 
                        class="w-full py-4 bg-gradient-to-r from-[#FF6B8A] to-[#FF8E53] text-white font-bold rounded-xl shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all active:scale-[0.98]">
                        Entrar no App
                    </button>
                </form>

                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-[#2a2a44]"></div>
                    </div>
                    <div class="relative flex justify-center text-xs">
                        <span class="bg-[#1e1e36] px-2 text-gray-500">Primeira vez aqui?</span>
                    </div>
                </div>

                <p class="text-center text-[11px] text-gray-500">
                    Ao entrar você concorda com nossos Termos de Uso.<br>
                    Seus dados são salvos localmente no navegador.
                </p>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons({ scope: loginRoot });
};

window.togglePasswordVisibility = function() {
    const passInput = document.getElementById('login-pass');
    const eyeIcon = document.getElementById('password-eye');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        passInput.type = 'password';
        eyeIcon.setAttribute('data-lucide', 'eye');
    }
    
    if (window.lucide) window.lucide.createIcons({ scope: eyeIcon.parentElement });
};

window.handleLogin = function(e) {
    e.preventDefault();
    
    const name = document.getElementById('login-name').value.trim();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    const errorDiv = document.getElementById('login-error');
    
    // Limpar erro anterior
    errorDiv.classList.add('hidden');
    
    // Validações
    if (name.length < 3) {
        errorDiv.textContent = 'Nome deve ter no mínimo 3 caracteres';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
        errorDiv.textContent = 'Email inválido';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = 'Senha deve ter no mínimo 6 caracteres';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Verificar se já existe usuário cadastrado
    const existingUser = localStorage.getItem('kanbada_user');
    
    if (existingUser) {
        // Modo Login - Validar credenciais
        const savedUser = JSON.parse(existingUser);
        const hashedInput = btoa(password); // Hash simples com Base64
        
        if (savedUser.email !== email) {
            errorDiv.textContent = 'Email não encontrado. Verifique suas credenciais.';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        if (savedUser.passwordHash !== hashedInput) {
            errorDiv.textContent = 'Senha incorreta. Tente novamente.';
            errorDiv.classList.remove('hidden');
            return;
        }
        
        // Login bem-sucedido
        const user = {
            ...savedUser,
            lastLogin: new Date().toISOString()
        };
        
        localStorage.setItem('kanbada_user', JSON.stringify(user));
        
        if (window.onLoginSuccess) {
            window.onLoginSuccess(user);
        }
        
    } else {
        // Modo Cadastro - Criar novo usuário
        const user = {
            name: name,
            email: email,
            passwordHash: btoa(password), // Hash simples com Base64
            initials: name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        localStorage.setItem('kanbada_user', JSON.stringify(user));
        
        if (window.onLoginSuccess) {
            window.onLoginSuccess(user);
        }
    }
};

// Função auxiliar para redefinir senha (caso esqueça)
window.resetPassword = function() {
    if (confirm('Isso apagará seu usuário atual e todas as tarefas. Deseja continuar?')) {
        localStorage.removeItem('kanbada_user');
        localStorage.removeItem('kanbada_tasks');
        localStorage.removeItem('kanbada_notifications');
        window.renderLogin();
        alert('Dados resetados! Você pode criar uma nova conta.');
    }
};
