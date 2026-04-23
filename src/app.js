/**
 * app.js
 * Controlador principal do Kanbada.
 */

// Global Error Logging — console only, never alert() in production
window.onerror = function(msg, url, line, col, error) {
    console.error('[Kanbada] JS Error:', msg, '| file:', url, '| line:', line, '|', error);
    // Não exibe toast para erros de script externo ou carregamento inicial
    // Isso evita que um toast de erro bloqueie a experiência do usuário
    return true; // true = não propaga para o browser (evita console duplicado)
};

window.onunhandledrejection = function(event) {
    console.error('[Kanbada] Promise rejection:', event.reason);
};

// State
let allTasks = [];
let currentUser = null;
let notifications = [];
let currentProjectFilter = null;
let showOnlyMyTasks = false;
let searchTerm = '';
let deletingId = null;
let pendingImportTasks = [];
let viewMode = 'board'; // 'board', 'list', 'archive', 'recycle'
let selectedTaskIds = []; // IDs das tarefas selecionadas para ações em massa
let currentEditingSubtasks = []; // Subtarefas da tarefa sendo editada no momento
let editingTaskId = null; // ID da tarefa que está sendo editada

// --- INIT PRINCIPAL ---
// Usa 'load' (não 'DOMContentLoaded') para garantir que TODOS os scripts
// — inclusive Login.js, Card.js, Column.js — foram totalmente executados
// antes de iniciar a autenticação e renderização do board.
window.addEventListener('load', function() {
    console.log('[Kanbada] window.load — todos os scripts prontos. Iniciando checkAuth...');
    if (typeof checkAuth === 'function') {
        checkAuth();
    } else {
        console.error('[Kanbada] checkAuth não definida. Verifique a ordem dos scripts.');
    }

    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        window.renderBoard(allTasks);
    });

    initSidebarListeners();
});



let allProjects = [
    { name: 'Redesign App', color: '#FF6B8A' },
    { name: 'Marketing Q4', color: '#6C63FF' },
    { name: 'Lançamento v2', color: '#00C9A7' }
];
let allColumns = [
    { id: 'plan', title: 'Plano', color: '#FF6B8A' },
    { id: 'progress', title: 'Em Andamento', color: '#6C63FF' },
    { id: 'done', title: 'Concluído', color: '#00C9A7' }
];

// Exporta getters ao invés de cópias — Card.js sempre lê o valor atual
Object.defineProperty(window, 'allColumns', {
    get: () => allColumns,
    set: (v) => { allColumns = v; },
    configurable: true
});
Object.defineProperty(window, 'allProjects', {
    get: () => allProjects,
    set: (v) => { allProjects = v; },
    configurable: true
});
Object.defineProperty(window, 'selectedTaskIds', {
    get: () => selectedTaskIds,
    set: (v) => { selectedTaskIds = v; },
    configurable: true
});

// --- ACESSO AOS SERVIÇOS GLOBAIS ---
// auth.service.js e db.service.js são carregados antes de app.js e definem
// window.authService / window.dbService. Os getters abaixo garantem que o
// código interno do app.js sempre resolva o valor atual, mesmo que os serviços
// sejam substituídos/reinicializados depois.
function getAuthService() { return window.authService; }
function getDbService()   { return window.dbService; }

// Aliases diretos para uso sem prefixo window — funcionam mesmo dentro
// de closures e funções async onde o escopo global pode não resolver.
// IMPORTANTE: estes são getters computados na chamada, não cópias da referência.
const authService = new Proxy({}, {
    get(_, prop) {
        const svc = window.authService;
        if (!svc) throw new Error('[Kanbada] authService não está disponível. Verifique a ordem dos scripts.');
        return typeof svc[prop] === 'function' ? svc[prop].bind(svc) : svc[prop];
    }
});
const dbService = new Proxy({}, {
    get(_, prop) {
        const svc = window.dbService;
        if (!svc) throw new Error('[Kanbada] dbService não está disponível. Verifique a ordem dos scripts.');
        return typeof svc[prop] === 'function' ? svc[prop].bind(svc) : svc[prop];
    }
});

// --- PERSISTÊNCIA DE DADOS (FIREBASE) ---
async function saveTasks(task = null) {
    if (!currentUser) return;
    try {
        if (task) {
            await dbService.saveTask(currentUser.uid, task);
        }
    } catch (e) {
        console.error('Erro ao salvar tarefa no Firestore:', e);
    }
}

async function loadTasks() {
    if (!currentUser) return;
    try {
        allTasks = await dbService.loadAllTasks(currentUser.uid);
        window.renderBoard(allTasks);
    } catch (e) {
        console.error('Erro ao carregar tarefas do Firestore:', e);
        allTasks = [];
        window.renderBoard(allTasks);
    }
}

function saveNotifications() {
    if (!currentUser) return;
    localStorage.setItem(`kanbada_notifications_${currentUser.uid}`, JSON.stringify(notifications));
}

function loadNotifications() {
    if (!currentUser) return;
    try {
        const saved = localStorage.getItem(`kanbada_notifications_${currentUser.uid}`);
        if (saved) {
            notifications = JSON.parse(saved);
            updateNotificationUI();
        }
    } catch (e) {
        console.warn('[Kanbada] Erro ao carregar notificações:', e);
    }
}

function updateNotificationUI() {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    if (!badge || !list) return;

    if (notifications.length > 0) {
        badge.classList.remove('hidden');
        list.innerHTML = notifications.map((n, i) => `
            <div class="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition-all">
                <div class="w-2 h-2 rounded-full bg-[#FF6B8A] mt-1.5 flex-shrink-0"></div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-300 leading-relaxed">${n.text}</p>
                    <span class="text-[9px] text-gray-600 mt-1">${n.time || ''}</span>
                </div>
            </div>
        `).join('');
    } else {
        badge.classList.add('hidden');
        list.innerHTML = '<div class="p-4 text-center text-xs text-gray-500 italic">Nenhuma notificação nova</div>';
    }
}

function addNotification(text) {
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    notifications.unshift({ text, time });
    // Mantém no máximo 20 notificações
    if (notifications.length > 20) notifications = notifications.slice(0, 20);
    saveNotifications();
    updateNotificationUI();
}

async function saveConfig() {
    if (!currentUser) return;
    try {
        await dbService.saveConfig(currentUser.uid, allProjects, allColumns);
    } catch (e) {
        console.error('Erro ao salvar config no Firestore:', e);
    }
}

async function loadConfig() {
    if (!currentUser) return;
    try {
        const config = await dbService.loadConfig(currentUser.uid);
        if (config.board) {
            if (config.board.projects) allProjects = config.board.projects;
            if (config.board.columns) allColumns = config.board.columns;
        }
        if (config.profile) {
            currentUser.name = config.profile.name || currentUser.displayName || 'Usuário';
            currentUser.initials = config.profile.initials || currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
    } catch (e) {
        console.error('Erro ao carregar config do Firestore:', e);
    }
}

// --- UTILITÁRIOS ---
window.showToast = function (msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `fixed bottom-6 right-6 z-[3000] px-4 py-3 rounded-lg text-sm font-bold shadow-2xl transition-all duration-300 animate-slide-up`;

    if (type === 'error') {
        toast.style.background = '#FF6B8A';
        toast.style.color = '#fff';
    } else {
        toast.style.background = '#2a2a44';
        toast.style.color = '#e0e0ec';
        toast.style.border = '1px solid rgba(255,255,255,0.1)';
    }

    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.classList.remove('opacity-0');
        }, 300);
    }, 3000);
};

// DIÁLOGOS CUSTOMIZADOS (PROMPT / CONFIRM)
window.customPrompt = function(title, msg, defaultValue = '') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const dTitle = document.getElementById('dialog-title');
        const dMsg = document.getElementById('dialog-msg');
        const dInput = document.getElementById('dialog-input');
        const dInputCont = document.getElementById('dialog-input-container');
        const btnConfirm = document.getElementById('dialog-confirm');
        const btnCancel = document.getElementById('dialog-cancel');

        dTitle.textContent = title;
        dMsg.textContent = msg;
        dInput.value = defaultValue;
        dInputCont.classList.remove('hidden');
        dialog.classList.remove('hidden');
        dInput.focus();

        const cleanup = () => {
            dialog.classList.add('hidden');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        };

        btnConfirm.onclick = () => {
            const val = dInput.value;
            cleanup();
            resolve(val);
        };
        btnCancel.onclick = () => {
            cleanup();
            resolve(null);
        };
    });
};

window.openModal = function(status = 'plan', taskId = null) {
    const modal = document.getElementById('task-modal');
    if (!modal) return;

    editingTaskId = taskId;
    const titleEl = document.getElementById('modal-title');
    const form = document.getElementById('task-form');

    // Reset da área de anexo
    const fileInput = document.getElementById('f-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const attachmentPreview = document.getElementById('attachment-preview');
    if (fileInput) fileInput.value = '';
    if (fileNameDisplay) { fileNameDisplay.textContent = ''; fileNameDisplay.classList.add('hidden'); }
    if (attachmentPreview) attachmentPreview.classList.add('hidden');
    window._currentAttachment = null; // limpa anexo pendente
    
    if (taskId) {
        titleEl.textContent = 'Editar Tarefa';
        const task = allTasks.find(t => t.__backendId === taskId);
        if (task) {
            document.getElementById('f-title').value = task.title || '';
            document.getElementById('f-desc').value = task.desc || '';
            document.getElementById('f-assignee').value = task.assignee || '';
            document.getElementById('f-project').value = task.project || 'Geral';
            document.getElementById('f-status').value = task.status || status;
            document.getElementById('f-priority').value = task.priority || 'Média';
            document.getElementById('f-due-date').value = task.due_date || '';
            currentEditingSubtasks = [...(task.subtasks || [])];

            // Carrega anexo existente
            if (task.attachment && task.attachment.data) {
                window._currentAttachment = task.attachment;
                renderAttachmentPreview(task.attachment);
            }
        }
    } else {
        titleEl.textContent = 'Nova Tarefa';
        if (form) form.reset();
        document.getElementById('f-status').value = status;
        currentEditingSubtasks = [];
    }

    // Wiring do input de arquivo
    if (fileInput) {
        fileInput.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 1.5 * 1024 * 1024) {
                window.showToast('Arquivo muito grande. Máximo 1MB.', 'error');
                fileInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(ev) {
                window._currentAttachment = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: ev.target.result // base64
                };
                renderAttachmentPreview(window._currentAttachment);
            };
            reader.readAsDataURL(file);
        };
    }

    renderSubtasks();
    modal.classList.remove('hidden');
};

function renderAttachmentPreview(attachment) {
    const preview = document.getElementById('attachment-preview');
    const uploadArea = document.getElementById('attachment-upload-area');
    if (!preview || !attachment) return;

    const isImage = attachment.type && attachment.type.startsWith('image/');
    const sizeKB = attachment.size ? (attachment.size / 1024).toFixed(0) : '?';

    preview.innerHTML = `
        <div class="flex items-center gap-3 p-3 bg-[#12121f] rounded-xl border border-[#2a2a44] group">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:#6C63FF20">
                <i data-lucide="${isImage ? 'image' : 'file'}" class="w-4 h-4" style="color:#6C63FF"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-white truncate">${attachment.name}</p>
                <p class="text-[9px] text-gray-500">${sizeKB} KB</p>
            </div>
            <div class="flex items-center gap-1">
                <a href="${attachment.data}" download="${attachment.name}"
                    class="p-1.5 rounded-lg hover:bg-[#6C63FF]/20 text-gray-500 hover:text-[#6C63FF] transition-all"
                    title="Baixar anexo">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                </a>
                <button type="button" onclick="window.removeAttachment()" 
                    class="p-1.5 rounded-lg hover:bg-[#FF6B8A]/20 text-gray-500 hover:text-[#FF6B8A] transition-all"
                    title="Remover anexo">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        </div>
    `;
    preview.classList.remove('hidden');
    if (uploadArea) uploadArea.classList.add('hidden');
    if (window.lucide) window.lucide.createIcons({ scope: preview });
}

window.removeAttachment = function() {
    window._currentAttachment = null;
    const preview = document.getElementById('attachment-preview');
    const uploadArea = document.getElementById('attachment-upload-area');
    const fileInput = document.getElementById('f-file');
    if (preview) preview.classList.add('hidden');
    if (uploadArea) uploadArea.classList.remove('hidden');
    if (fileInput) fileInput.value = '';
};

window.closeModal = function() {
    document.getElementById('task-modal')?.classList.add('hidden');
};

window.handleSubmit = async function(e) {
    if (e) e.preventDefault();
    const taskData = {
        title: document.getElementById('f-title').value,
        desc: document.getElementById('f-desc').value,
        assignee: document.getElementById('f-assignee').value,
        project: document.getElementById('f-project').value,
        status: document.getElementById('f-status').value,
        priority: document.getElementById('f-priority').value,
        due_date: document.getElementById('f-due-date').value,
        subtasks: currentEditingSubtasks,
        createdAt: new Date().toISOString()
    };

    // Salva o anexo se houver um pendente
    if (window._currentAttachment) {
        taskData.attachment = window._currentAttachment;
    } else if (editingTaskId) {
        // Se editando e sem novo anexo, mantém o existente (ou null se removeu)
        const existing = allTasks.find(t => t.__backendId === editingTaskId);
        if (existing && existing.attachment && window._currentAttachment !== null) {
            // _currentAttachment null = removido pelo usuário; undefined = não alterado
            taskData.attachment = existing.attachment;
        }
    }
    
    let task;
    if (editingTaskId) {
        const idx = allTasks.findIndex(t => t.__backendId === editingTaskId);
        if (idx !== -1) {
            allTasks[idx] = { ...allTasks[idx], ...taskData };
            task = allTasks[idx];
        }
    } else {
        task = { ...taskData, __backendId: crypto.randomUUID() };
        allTasks.push(task);
    }
    
    await saveTasks(task);
    window.renderBoard(allTasks);
    window.closeModal();
    window.showToast(editingTaskId ? 'Tarefa atualizada!' : 'Tarefa criada!');
    window._currentAttachment = undefined; // reset para próxima abertura
};

window.addSubtask = function() {
    const input = document.getElementById('f-subtask-input');
    const text = input.value.trim();
    if (!text) return;
    currentEditingSubtasks.push({ text, done: false, completed: false }); // Sincronizado com Card.js
    input.value = '';
    renderSubtasks();
};

window.toggleSubtask = function(index) {
    const st = currentEditingSubtasks[index];
    st.done = !st.done;
    st.completed = st.done; // Sincronizado com Card.js
    renderSubtasks();
};

window.removeSubtask = function(index) {
    currentEditingSubtasks.splice(index, 1);
    renderSubtasks();
};

window.customConfirm = function(title, msg, isDanger = false) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const dTitle = document.getElementById('dialog-title');
        const dMsg = document.getElementById('dialog-msg');
        const dInputCont = document.getElementById('dialog-input-container');
        const btnConfirm = document.getElementById('dialog-confirm');
        const btnCancel = document.getElementById('dialog-cancel');

        dTitle.textContent = title;
        dMsg.textContent = msg;
        dInputCont.classList.add('hidden');
        dialog.classList.remove('hidden');

        if (isDanger) {
            btnConfirm.style.background = '#FF6B8A';
        } else {
            btnConfirm.style.background = '#6C63FF';
        }

        const cleanup = () => {
            dialog.classList.add('hidden');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        };

        btnConfirm.onclick = () => {
            cleanup();
            resolve(true);
        };
        btnCancel.onclick = () => {
            cleanup();
            resolve(false);
        };
    });
};

// SUBTAREFAS
function renderSubtasks() {
    const container = document.getElementById('subtasks-list');
    if (!container) return;
    container.innerHTML = currentEditingSubtasks.map((st, index) => `
        <div class="flex items-center gap-3 p-3 bg-[#12121f] rounded-xl border border-[#2a2a44] group">
            <input type="checkbox" ${st.done ? 'checked' : ''} 
                onchange="window.toggleSubtask(${index})"
                class="w-4 h-4 rounded border-[#2a2a44] bg-transparent text-[#FF6B8A] focus:ring-[#FF6B8A]">
            <span class="text-sm flex-1 ${st.done ? 'line-through text-gray-500' : 'text-gray-300'}">${st.text}</span>
            <button type="button" onclick="window.removeSubtask(${index})" class="text-gray-500 hover:text-[#FF6B8A] opacity-0 group-hover:opacity-100 transition-all">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons({ scope: container });
}

// --- AUTH (FIREBASE OBSERVER) ---
function checkAuth() {
    authService.onAuthChange(async (user) => {
        console.log("Auth State Changed:", user ? "User Logged In" : "No User");
        if (user) {
            currentUser = user;
            await showApp();
        } else {
            currentUser = null;
            hideApp();
        }
    });
}

async function showApp() {
    document.getElementById('login-root').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Carregar dados na ordem correta
    await loadConfig();

    // Garante que currentUser.name e currentUser.initials existem para updateAvatars()
    if (!currentUser.name) {
        currentUser.name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuário';
    }
    if (!currentUser.initials) {
        currentUser.initials = currentUser.name
            .split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    updateAvatars();
    renderProjectsSidebar();
    updateProjectSelects();
    await loadTasks();
    loadNotifications();

    const nome = currentUser.name || 'Usuário';
    window.showToast(`Bem-vindo, ${nome}!`);
}

function hideApp() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-root').classList.remove('hidden');
    if (window.renderLogin) window.renderLogin();
}

window.onLoginSuccess = async (u) => {
    currentUser = u;
    await showApp();
};

function updateAvatars() {
    if (!currentUser) return;
    document.querySelectorAll('.avatar-user').forEach(av => {
        av.textContent = currentUser.initials;
    });
    const nd = document.getElementById('user-display-name');
    if (nd) nd.textContent = currentUser.name;
}

// --- LOGOUT ---
window.logout = async function () {
    const confirmed = await window.customConfirm('Confirmar Saída', 'Deseja realmente sair? Suas tarefas estão sincronizadas.', false);
    if (!confirmed) return;
    await authService.logout();
    window.showToast('Você saiu com sucesso.');
};

// --- IMPORTAÇÃO CSV (usa xlsx para parsing robusto: suporta campos com vírgulas/aspas) ---
function parseCSV(text) {
    try {
        // Usa a lib xlsx já carregada para parsear CSV de forma robusta
        const workbook = XLSX.read(text, { type: 'string', raw: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch (e) {
        console.error('Erro ao parsear CSV via xlsx:', e);
        // Fallback simples (sem suporte a aspas) — apenas para casos extremos
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = values[i] || ''; });
            return obj;
        });
    }
}

// --- IMPORT ASANA/CSV ROBUSTO ---
window.triggerImport = () => document.getElementById('asana-import-input').click();

window.handleFileImport = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    window.showToast('Processando arquivo...');

    if (fileType === 'csv') {
        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const csvText = evt.target.result;
                const data = parseCSV(csvText);

                if (!window.dataMapper) throw new Error('Data Mapper não carregado.');
                const newTasks = window.dataMapper.transformAsanaData(data);

                if (newTasks.length === 0) {
                    window.showToast('Nenhuma tarefa válida encontrada no CSV.', 'error');
                    return;
                }

                checkDuplicatesAndImport(newTasks);
            } catch (err) {
                console.error('Erro CSV:', err);
                window.showToast('Erro ao ler CSV: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
        // Processar Excel
        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];

                // Detecção de cabeçalho
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                let headerIndex = 0;
                const keywords = ['name', 'nome', 'task', 'tarefa', 'projeto', 'project'];

                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const row = rows[i];
                    if (Array.isArray(row)) {
                        const hasKeywords = row.some(cell =>
                            cell && keywords.includes(cell.toString().toLowerCase().trim())
                        );
                        if (hasKeywords) {
                            headerIndex = i;
                            break;
                        }
                    }
                }

                const rawData = XLSX.utils.sheet_to_json(sheet, { range: headerIndex });

                if (!window.dataMapper) throw new Error('Data Mapper não carregado.');
                const newTasks = window.dataMapper.transformAsanaData(rawData);

                if (newTasks.length === 0) {
                    window.showToast('Nenhuma tarefa válida no Excel.', 'error');
                    return;
                }

                checkDuplicatesAndImport(newTasks);
            } catch (err) {
                console.error("Erro Excel:", err);
                window.showToast('Erro: ' + (err.message || 'Falha ao ler Excel'), 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        window.showToast('Formato não suportado. Use .xlsx, .xls ou .csv', 'error');
    }

    e.target.value = ''; // Reset
};

function checkDuplicatesAndImport(newTasks) {
    const duplicates = newTasks.filter(nt =>
        allTasks.some(at =>
            normalizeString(at.title) === normalizeString(nt.title)
        )
    );

    if (duplicates.length > 0) {
        pendingImportTasks = newTasks;
        // Se houver modal de importação, exibe. Caso contrário, apenas importa (fallback seguro)
        const modalMsg = document.getElementById('import-modal-msg');
        const modal = document.getElementById('import-modal');
        if (modal && modalMsg) {
            modalMsg.innerHTML = `O arquivo contém <strong>${newTasks.length}</strong> tarefas.<br>Detectamos <strong>${duplicates.length}</strong> duplicatas.<br><br>Como deseja prosseguir?`;
            modal.classList.remove('hidden');
        } else {
            completeImport(newTasks);
        }
    } else {
        completeImport(newTasks);
    }
}

function normalizeString(str) {
    return str.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .trim();
}

window.confirmImport = function (mode) {
    document.getElementById('import-modal').classList.add('hidden');
    if (mode === 'cancel') {
        pendingImportTasks = [];
        return;
    }

    if (mode === 'replace') {
        const newTitles = pendingImportTasks.map(t => normalizeString(t.title));
        allTasks = allTasks.filter(t => !newTitles.includes(normalizeString(t.title)));
        completeImport(pendingImportTasks);
    } else {
        completeImport(pendingImportTasks);
    }
    pendingImportTasks = [];
};

async function completeImport(tasks) {
    if (!currentUser) return;
    try {
        window.showToast(`Importando ${tasks.length} tarefas...`);
        // Garante que todas tenham __backendId antes de salvar
        const tasksToSave = tasks.map(t => ({...t, __backendId: t.__backendId || crypto.randomUUID()}));
        await dbService.batchSaveTasks(currentUser.uid, tasksToSave);
        allTasks = [...allTasks, ...tasksToSave];
        window.renderBoard(allTasks);
        window.showToast(`${tasks.length} tarefas importadas!`);
        addNotification(`${tasks.length} tarefas importadas.`);
    } catch (e) {
        console.error('Erro no batch import:', e);
        window.showToast('Erro ao importar para o banco de dados.', 'error');
    }
}

// --- GOOGLE SHEETS IMPORT ---
window.importGoogleSheets = async function () {
    const url = await window.customPrompt('Importar Google Sheets', 'Cole o link público da planilha:');
    if (!url) return;

    const sheetId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!sheetId) {
        window.showToast('Link inválido. Certifique-se de colar a URL completa.', 'error');
        return;
    }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

    window.showToast('Importando do Google Sheets...');

    fetch(csvUrl)
        .then(r => {
            if (!r.ok) throw new Error('Planilha não é pública ou não existe');
            return r.text();
        })
        .then(csvText => {
            const data = parseCSV(csvText);
            const newTasks = window.dataMapper.transformAsanaData(data);
            if (newTasks.length === 0) {
                window.showToast('Nenhuma tarefa encontrada na planilha.', 'error');
                return;
            }
            checkDuplicatesAndImport(newTasks);
        })
        .catch(err => {
            console.error('Erro Google Sheets:', err);
            window.showToast('Erro: Certifique-se que a planilha é pública', 'error');
        });
};

// --- EXPORTAR DADOS ---
window.exportTasks = function () {
    const dataStr = JSON.stringify(allTasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `kanbada_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    window.showToast('Backup exportado com sucesso!');
};

async function cleanupRecycleBin() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const toDelete = allTasks.filter(t => {
        if (t.deleted && t.deletedAt) {
            return new Date(t.deletedAt).getTime() <= sevenDaysAgo;
        }
        return false;
    });

    if (toDelete.length === 0) return;

    // Remove do array local
    allTasks = allTasks.filter(t => !toDelete.includes(t));

    // Remove do Firestore em background (não bloqueia o render)
    if (currentUser) {
        toDelete.forEach(t => {
            dbService.deleteTask(currentUser.uid, t.__backendId).catch(e =>
                console.error('[Kanbada] Erro ao limpar lixeira:', e)
            );
        });
    }
}

// --- RENDER & FILTERS ---
function getVisibleTasks(data = allTasks) {
    let filtered = [];
    if (viewMode === 'board' || viewMode === 'list') {
        filtered = data.filter(t => !t.archived && !t.deleted);
    } else if (viewMode === 'archive') {
        filtered = data.filter(t => t.archived && !t.deleted);
    } else if (viewMode === 'recycle') {
        filtered = data.filter(t => t.deleted);
    }

    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filtered = filtered.filter(t =>
            (t.title || '').toLowerCase().includes(search) ||
            (t.assignee || '').toLowerCase().includes(search) ||
            (t.project || '').toLowerCase().includes(search)
        );
    }

    if (currentProjectFilter && (viewMode === 'board' || viewMode === 'list')) {
        filtered = filtered.filter(t => (t.project || 'Geral') === currentProjectFilter);
    }

    if (showOnlyMyTasks && currentUser) {
        filtered = filtered.filter(t =>
            (t.assignee || '').toLowerCase().includes(currentUser.name.toLowerCase())
        );
    }
    return filtered;
}

window.renderBoard = async function (data) {
    await cleanupRecycleBin();
    const boardTitle = document.getElementById('board-title');
    const filtered = getVisibleTasks(data);

    // Atualiza indicadores de filtro
    const filterIndicator = document.getElementById('filter-indicator');
    if (filterIndicator) {
        if (currentProjectFilter && (viewMode === 'board' || viewMode === 'list')) {
            filterIndicator.classList.remove('hidden');
        } else {
            filterIndicator.classList.add('hidden');
        }
    }

    // Se estiver em modo lista, renderiza tabela e sai
    if (viewMode === 'list') {
        if (boardTitle && (viewMode === 'board' || viewMode === 'list')) boardTitle.textContent = 'Quadro de Tarefas';
        const container = document.getElementById('kanban-board-container');
        if (container) {
            container.className = "flex flex-col h-full p-6 pt-2 gap-6";
        }
        renderListView(filtered);
        updateBulkBar();
        return;
    }

    // Se estiver em modo Arquivo ou Lixeira (Grid 3x9)
    if (viewMode === 'archive' || viewMode === 'recycle') {
        if (boardTitle) boardTitle.textContent = viewMode === 'archive' ? 'Arquivo' : 'Lixeira (Últimos 7 dias)';
        
        let tasks = [...filtered];
        // Ordenar por data de modificação ou criação (mais recentes primeiro)
        tasks.sort((a, b) => {
            const timeA = a.updatedAt ? (typeof a.updatedAt.toDate === 'function' ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime()) : 0;
            const timeB = b.updatedAt ? (typeof b.updatedAt.toDate === 'function' ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime()) : 0;
            return timeB - timeA;
        });
        
        // Limite de 27 tarefas (3 colunas x 9 linhas)
        tasks = tasks.slice(0, 27);

        const container = document.getElementById('kanban-board-container');
        if (container) {
            // Remove 'min-w-max' e ajusta layout para o grid
            container.className = "w-full h-full p-6 pt-2";
            
            container.innerHTML = `
                <div class="w-full max-w-7xl mx-auto">
                    <div class="flex items-center justify-between mb-4">
                        <span class="font-semibold text-sm" style="color:#e0e0ec">
                            ${viewMode === 'archive' ? 'Tarefas Arquivadas (Mais recentes)' : 'Tarefas na Lixeira (Mais recentes)'}
                        </span>
                        <span class="text-xs px-3 py-1 rounded-full font-bold" style="background:#2a2a44;color:#9090b0">
                            ${tasks.length} / 27 exibidas
                        </span>
                    </div>
                    ${tasks.length === 0 ? `
                        <div class="w-full flex flex-col items-center justify-center py-20 text-gray-500">
                            <i data-lucide="inbox" class="w-16 h-16 mb-4 opacity-20"></i>
                            <p>Nenhuma tarefa encontrada.</p>
                        </div>
                    ` : `
                        <div id="grid-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full pb-10"></div>
                    `}
                </div>
            `;
            
            const gridContainer = document.getElementById('grid-container');
            if (gridContainer) {
                tasks.forEach(t => gridContainer.appendChild(window.createTaskCard(t)));
            }
            if (window.lucide) window.lucide.createIcons({ scope: container });
        }
        updateBulkBar();
        return;
    }

    let colsToRender = [];
    if (viewMode === 'board') {
        colsToRender = allColumns;
        if (boardTitle) boardTitle.textContent = 'Quadro de Tarefas';
    }

    const container = document.getElementById('kanban-board-container');
    if (container) {
        // Restaura as classes originais do board
        container.className = "flex h-full p-6 pt-2 gap-6 min-w-max";
        
        let boardHtml = colsToRender.map(col => `
            <div class="flex flex-col" style="width:320px;min-width:300px;flex-shrink:0">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <span style="width:10px;height:10px;border-radius:50%;background:${col.color}"></span>
                        <span class="font-semibold text-sm" style="color:#e0e0ec">${col.title}</span>
                        <span id="count-${col.id}" class="text-xs px-2 py-0.5 rounded-full" style="background:#2a2a44;color:#9090b0">0</span>
                    </div>
                    <div class="flex items-center gap-1">
                        ${viewMode === 'board' ? `
                            <button onclick="window.promptEditColumn('${col.id}')" class="text-gray-500 hover:text-blue-400 p-1" title="Editar coluna"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                            <button onclick="window.promptDeleteColumn('${col.id}')" class="text-gray-500 hover:text-[#FF6B8A] p-1" title="Excluir coluna"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                            <button onclick="window.openModal('${col.id}')" class="add-btn hover:text-[${col.color}] transition-colors ml-1" style="color:#9090b0" title="Adicionar tarefa">
                                <i data-lucide="plus" style="width:18px;height:18px"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div id="col-${col.id}" class="kanban-col flex flex-col gap-3 flex-1 overflow-y-auto pr-1" data-status="${col.id}"></div>
            </div>
        `).join('');

        if (viewMode === 'board') {
            boardHtml += `
                <div class="flex-shrink-0 w-full lg:w-[320px] pb-10 lg:pb-0">
                    <button onclick="window.promptNewColumn()"
                        class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[#2a2a44] text-[#9090b0] hover:border-[#FF6B8A] hover:text-[#FF6B8A] transition-colors mt-2 lg:mt-[48px] w-full h-fit">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span class="font-bold text-sm">Adicionar Coluna</span>
                    </button>
                </div>
            `;
        }
        container.innerHTML = boardHtml;
    }

    colsToRender.forEach(col => {
        let tasks = [];
        if (viewMode === 'board') tasks = filtered.filter(t => t.status === col.id);

        const colEl = document.getElementById(`col-${col.id}`);
        const countEl = document.getElementById(`count-${col.id}`);
        if (colEl) {
            colEl.innerHTML = '';
            if (countEl) countEl.textContent = tasks.length;
            tasks.forEach(t => colEl.appendChild(window.createTaskCard(t)));
        }
    });

    if (window.lucide) window.lucide.createIcons({ scope: container });
    initSortable();
    updateProjectSelects();
    updateBulkBar();
};

let _sortableInstances = [];

function initSortable() {
    // Destrói instâncias anteriores para evitar listeners duplicados
    _sortableInstances.forEach(inst => { try { inst.destroy(); } catch(e) {} });
    _sortableInstances = [];

    const cols = document.querySelectorAll('.kanban-col');
    cols.forEach(col => {
        const inst = new Sortable(col, {
            group: 'tasks',
            animation: 150,
            ghostClass: 'opacity-50',
            dragClass: 'rotate-2',
            onEnd: async (evt) => {
                const taskId = evt.item.dataset.id;
                const newStatus = evt.to.dataset.status;
                const task = allTasks.find(t => t.__backendId === taskId);
                if (task && task.status !== newStatus) {
                    task.status = newStatus;
                    await saveTasks(task);
                    window.renderBoard(allTasks);
                    window.showToast(`Tarefa movida para ${newStatus}`);
                }
            }
        });
        _sortableInstances.push(inst);
    });
}

function renderListView(tasks) {
    const container = document.getElementById('kanban-board-container');
    if (!container) return;
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="w-full flex flex-col items-center justify-center py-20 text-gray-500">
                <i data-lucide="inbox" class="w-16 h-16 mb-4 opacity-20"></i>
                <p>Nenhuma tarefa encontrada nesta visualização.</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons({ scope: container });
        return;
    }

    const tableHtml = `
        <div class="w-full overflow-x-auto bg-[#1e1e36] rounded-[24px] border border-[#2a2a44] p-2">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-bottom border-[#2a2a44]">
                        <th class="px-6 py-4 w-10">
                            <input type="checkbox" onchange="window.toggleAllSelect(this.checked)" class="rounded bg-transparent border-[#2a2a44]">
                        </th>
                        <th class="px-6 py-4">Tarefa</th>
                        <th class="px-6 py-4">Status</th>
                        <th class="px-6 py-4">Projeto</th>
                        <th class="px-6 py-4">Prioridade</th>
                        <th class="px-6 py-4">Entrega</th>
                        <th class="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-[#2a2a44]/50">
                    ${tasks.map(t => `
                        <tr class="group hover:bg-white/[0.02] transition-colors">
                            <td class="px-6 py-4">
                                <input type="checkbox" ${selectedTaskIds.includes(t.__backendId) ? 'checked' : ''} 
                                    onchange="window.toggleTaskSelect('${t.__backendId}')"
                                    class="rounded bg-transparent border-[#2a2a44] text-[#FF6B8A] focus:ring-[#FF6B8A]">
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex flex-col">
                                    <span class="text-sm font-bold text-white">${t.title}</span>
                                    <span class="text-[10px] text-gray-500 truncate max-w-[200px]">${t.desc || 'Sem descrição'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <select onchange="window.updateTaskStatusFromList('${t.__backendId}', this.value)"
                                    class="text-[10px] font-bold px-2 py-1 rounded-full border-0 outline-none cursor-pointer appearance-none"
                                    style="background:${allColumns.find(c => c.id === t.status)?.color}20; color:${allColumns.find(c => c.id === t.status)?.color}">
                                    ${allColumns.map(c => `<option value="${c.id}" ${c.id === t.status ? 'selected' : ''} style="background:#1e1e36;color:#e0e0ec">${c.title}</option>`).join('')}
                                </select>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <div class="w-2 h-2 rounded-full" style="background:${allProjects.find(p => p.name === t.project)?.color || '#9090b0'}"></div>
                                    <span class="text-xs text-gray-400">${t.project || 'Geral'}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="text-xs font-medium ${t.priority === 'Alta' ? 'text-[#FF6B8A]' : t.priority === 'Média' ? 'text-[#FFB84D]' : 'text-[#00C9A7]'}">
                                    ${t.priority || 'Média'}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-xs text-gray-500">
                                ${t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td class="px-6 py-4 text-right">
                                <button onclick="window.openModal('${t.status}', '${t.__backendId}')" class="p-2 text-gray-500 hover:text-white transition-colors">
                                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = tableHtml;
    if (window.lucide) window.lucide.createIcons({ scope: container });
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if (!bar) return;
    if (selectedTaskIds.length > 0) {
        bar.classList.remove('hidden');
        const countEl = document.getElementById('selected-count');
        if (countEl) countEl.textContent = selectedTaskIds.length;

        // Popula o select de colunas com as colunas atuais
        const sel = document.getElementById('bulk-status-select');
        if (sel) {
            sel.innerHTML = '<option value="">Mover para...</option>' +
                allColumns.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    } else {
        bar.classList.add('hidden');
    }
}

window.toggleTaskSelect = function(id) {
    if (selectedTaskIds.includes(id)) {
        selectedTaskIds = selectedTaskIds.filter(i => i !== id);
    } else {
        selectedTaskIds.push(id);
    }
    updateBulkBar();
};

window.toggleAllSelect = function(checked) {
    const visible = getVisibleTasks();
    if (checked) {
        selectedTaskIds = visible.map(t => t.__backendId);
    } else {
        selectedTaskIds = [];
    }
    window.renderBoard(allTasks);
};

window.bulkArchive = async function() {
    const confirm = await window.customConfirm('Arquivar em Massa', `Deseja arquivar ${selectedTaskIds.length} tarefas?`, false);
    if (!confirm) return;
    
    for (const id of selectedTaskIds) {
        const task = allTasks.find(t => t.__backendId === id);
        if (task) {
            task.archived = true;
            await saveTasks(task);
        }
    }
    selectedTaskIds = [];
    window.renderBoard(allTasks);
    window.showToast('Tarefas arquivadas!');
};

// Arquivar tarefa individual (botão no card)
window.archiveTask = async function(taskId) {
    const task = allTasks.find(t => t.__backendId === taskId);
    if (!task) return;
    task.archived = true;
    await saveTasks(task);
    window.renderBoard(allTasks);
    window.showToast(`"${task.title}" arquivada!`);
};

// Restaurar tarefa arquivada (botão no card dentro de Arquivadas)
window.restoreTask = async function(taskId) {
    const task = allTasks.find(t => t.__backendId === taskId);
    if (!task) return;
    task.archived = false;
    await saveTasks(task);
    window.renderBoard(allTasks);
    window.showToast(`"${task.title}" restaurada!`);
};

window.bulkDelete = async function() {
    const confirm = await window.customConfirm('Excluir em Massa', `Deseja enviar ${selectedTaskIds.length} tarefas para a lixeira?`, true);
    if (!confirm) return;
    
    for (const id of selectedTaskIds) {
        const task = allTasks.find(t => t.__backendId === id);
        if (task) {
            task.deleted = true;
            task.deletedAt = new Date().toISOString();
            await saveTasks(task);
        }
    }
    selectedTaskIds = [];
    window.renderBoard(allTasks);
    window.showToast('Tarefas enviadas para a lixeira!');
};

window.clearFilters = function () {
    currentProjectFilter = null;
    showOnlyMyTasks = false;
    searchTerm = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const navHome = document.getElementById('nav-home');
    if (navHome) navHome.classList.add('active');
    window.renderBoard(allTasks);
};

// --- RELATÓRIOS ---
window.showReports = function () {
    const activeTasks = allTasks.filter(t => !t.deleted && !t.archived);
    const total = activeTasks.length;

    // Contagens por coluna (dinâmico)
    const byCols = allColumns.map(col => ({
        id: col.id,
        title: col.title,
        color: col.color,
        count: activeTasks.filter(t => t.status === col.id).length
    }));

    // Última coluna = "concluído" para taxa de conclusão
    const lastCol = allColumns[allColumns.length - 1];
    const doneCount = lastCol ? activeTasks.filter(t => t.status === lastCol.id).length : 0;
    const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    // Tarefas atrasadas
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = activeTasks.filter(t => {
        if (!t.due_date || t.status === lastCol?.id) return false;
        const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
        return d < today;
    }).length;

    // Por projeto
    const byProject = {};
    activeTasks.forEach(t => {
        const p = t.project || 'Geral';
        if (!byProject[p]) byProject[p] = { total: 0, done: 0 };
        byProject[p].total++;
        if (lastCol && t.status === lastCol.id) byProject[p].done++;
    });

    // Por responsável
    const byAssignee = {};
    activeTasks.forEach(t => {
        const a = t.assignee || 'Sem responsável';
        if (!byAssignee[a]) byAssignee[a] = 0;
        byAssignee[a]++;
    });
    const topAssignees = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Tarefas sem data de entrega
    const noDate = activeTasks.filter(t => !t.due_date).length;

    // Render
    const modal = document.getElementById('reports-modal');
    const content = document.getElementById('reports-content');
    if (!modal || !content) return;

    const colBars = byCols.map(col => {
        const pct = total > 0 ? Math.round((col.count / total) * 100) : 0;
        return `
        <div>
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                    <span style="width:8px;height:8px;border-radius:50%;background:${col.color};flex-shrink:0"></span>
                    <span class="text-xs text-gray-300 truncate" style="max-width:120px">${col.title}</span>
                </div>
                <span class="text-xs font-bold" style="color:${col.color}">${col.count}</span>
            </div>
            <div class="rounded-full overflow-hidden" style="height:6px;background:#2a2a44">
                <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${col.color}"></div>
            </div>
        </div>`;
    }).join('');

    const projectRows = Object.entries(byProject).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => {
        const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
        return `
        <div class="flex items-center justify-between py-2" style="border-bottom:1px solid #2a2a44">
            <span class="text-xs text-gray-300 truncate flex-1 mr-4">${name}</span>
            <div class="flex items-center gap-3">
                <div class="rounded-full overflow-hidden" style="width:80px;height:4px;background:#2a2a44">
                    <div class="h-full rounded-full" style="width:${pct}%;background:#00C9A7"></div>
                </div>
                <span class="text-xs font-mono" style="color:#9090b0;min-width:40px;text-align:right">${data.done}/${data.total}</span>
                <span class="text-xs font-bold" style="color:${pct === 100 ? '#00C9A7' : '#9090b0'};min-width:36px;text-align:right">${pct}%</span>
            </div>
        </div>`;
    }).join('');

    const assigneeRows = topAssignees.map(([name, count]) => `
        <div class="flex items-center gap-2 py-1.5">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style="background:linear-gradient(135deg,#FF6B8A,#c850c0)">
                ${name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <span class="text-xs text-gray-300 truncate flex-1">${name}</span>
            <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:#2a2a44;color:#9090b0">${count}</span>
        </div>`).join('');

    content.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-xl" style="background:rgba(108,99,255,0.15)">
                    <i data-lucide="bar-chart-2" style="width:20px;height:20px;color:#6C63FF"></i>
                </div>
                <div>
                    <h2 class="font-bold text-base text-white">Relatórios</h2>
                    <p class="text-xs" style="color:#9090b0">Visão geral do quadro</p>
                </div>
            </div>
            <button onclick="document.getElementById('reports-modal').classList.add('hidden')"
                style="color:#9090b0" title="Fechar">
                <i data-lucide="x" style="width:20px;height:20px"></i>
            </button>
        </div>

        <!-- KPIs -->
        <div class="grid grid-cols-2 gap-3 mb-6" style="grid-template-columns:repeat(4,1fr)">
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <p class="text-[10px] uppercase tracking-wider mb-1" style="color:#6a6a8e">Total</p>
                <p class="text-2xl font-bold text-white">${total}</p>
            </div>
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <p class="text-[10px] uppercase tracking-wider mb-1" style="color:#6a6a8e">Concluídas</p>
                <p class="text-2xl font-bold" style="color:#00C9A7">${doneCount}</p>
            </div>
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <p class="text-[10px] uppercase tracking-wider mb-1" style="color:#6a6a8e">Taxa de Conclusão</p>
                <p class="text-2xl font-bold" style="color:${completionRate >= 75 ? '#00C9A7' : completionRate >= 40 ? '#FFB84D' : '#FF6B8A'}">${completionRate}%</p>
            </div>
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <p class="text-[10px] uppercase tracking-wider mb-1" style="color:#6a6a8e">Atrasadas</p>
                <p class="text-2xl font-bold" style="color:${overdue > 0 ? '#FF6B8A' : '#9090b0'}">${overdue}</p>
            </div>
        </div>

        <div class="grid gap-5" style="grid-template-columns:1fr 1fr">
            <!-- Distribuição por Coluna -->
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <h3 class="text-xs font-bold text-white mb-4 uppercase tracking-wider">Distribuição por Coluna</h3>
                ${total === 0 ? '<p class="text-xs text-gray-500 italic text-center py-4">Nenhuma tarefa ainda</p>' : `<div class="space-y-3">${colBars}</div>`}
            </div>

            <!-- Responsáveis -->
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <h3 class="text-xs font-bold text-white mb-4 uppercase tracking-wider">Top Responsáveis</h3>
                ${topAssignees.length === 0 ? '<p class="text-xs text-gray-500 italic text-center py-4">Nenhum responsável atribuído</p>' : assigneeRows}
            </div>
        </div>

        <!-- Por Projeto -->
        <div class="mt-5 p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
            <h3 class="text-xs font-bold text-white mb-2 uppercase tracking-wider">Progresso por Projeto</h3>
            ${Object.keys(byProject).length === 0
            ? '<p class="text-xs text-gray-500 italic text-center py-4">Nenhuma tarefa com projeto</p>'
            : projectRows}
        </div>

        <!-- Info adicional -->
        <div class="mt-4 flex gap-4 text-[10px]" style="color:#6a6a8e">
            <span>📁 Arquivadas: ${allTasks.filter(t => t.archived && !t.deleted).length}</span>
            <span>🗑️ Na lixeira: ${allTasks.filter(t => t.deleted).length}</span>
            <span>📅 Sem prazo: ${noDate}</span>
        </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons({ scope: content });
};

window.closeReportsModal = function () {
    document.getElementById('reports-modal').classList.add('hidden');
};

// --- APP INIT & LISTENERS ---
function initSidebarListeners() {
    document.getElementById('nav-home')?.addEventListener('click', () => {
        viewMode = 'board';
        const bt = document.getElementById('board-title');
        if (bt) bt.textContent = 'Quadro de Tarefas';
        window.clearFilters();
    });

    document.getElementById('nav-my-tasks')?.addEventListener('click', (e) => {
        viewMode = 'board';
        const bt = document.getElementById('board-title');
        if (bt) bt.textContent = 'Quadro de Tarefas';
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        showOnlyMyTasks = true;
        currentProjectFilter = null;
        window.renderBoard(allTasks);
    });

    document.getElementById('nav-reports')?.addEventListener('click', (e) => {
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        window.showReports();
        if (window.innerWidth < 1024) window.closeSidebar();
    });

    document.getElementById('nav-archive')?.addEventListener('click', (e) => {
        viewMode = 'archive';
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentProjectFilter = null;
        window.renderBoard(allTasks);
        if (window.innerWidth < 1024) window.closeSidebar();
    });

    document.getElementById('nav-recycle')?.addEventListener('click', (e) => {
        viewMode = 'recycle';
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentProjectFilter = null;
        window.renderBoard(allTasks);
        if (window.innerWidth < 1024) window.closeSidebar();
    });
}

// --- GLOBAL ACTIONS FOR INDEX.HTML ---
window.setView = function(mode) {
    viewMode = mode;
    currentProjectFilter = null;
    showOnlyMyTasks = false;
    
    // Atualiza classes ativas na sidebar
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById('nav-' + mode);
    if (navItem) navItem.classList.add('active');

    window.renderBoard(allTasks);
    if (window.innerWidth < 1024) window.closeSidebar();
};

window.openReports = function() {
    window.showReports();
};

window.filterByProject = function(projectName) {
    currentProjectFilter = projectName;
    viewMode = 'board';
    window.renderBoard(allTasks);
};

window.promptNewProject = async function() {
    const name = await window.customPrompt('Novo Projeto', 'Digite o nome do projeto:');
    if (!name) return;
    const colors = ['#FF6B8A', '#6C63FF', '#00C9A7', '#FFB84D', '#4DA8FF'];
    const color = colors[allProjects.length % colors.length];
    allProjects.push({ name, color });
    saveConfig();
    renderProjectsSidebar();
    window.showToast(`Projeto "${name}" criado!`);
};

window.openSidebar = () => {
    document.getElementById('sidebar')?.classList.remove('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.remove('hidden');
};

window.closeSidebar = () => {
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay')?.classList.add('hidden');
};

// Funções Globais Adicionais
window.editTask = function(id) {
    window.openModal('plan', id);
};

window.toggleDelete = async function(id) {
    const confirm = await window.customConfirm('Mover para Lixeira', 'Deseja realmente enviar esta tarefa para a lixeira?', true);
    if (!confirm) return;
    const task = allTasks.find(t => t.__backendId === id);
    if (task) {
        task.deleted = true;
        task.deletedAt = new Date().toISOString();
        await saveTasks(task);
        window.renderBoard(allTasks);
        window.showToast('Tarefa movida para a lixeira');
    }
};

window.clearSelection = function() {
    selectedTaskIds = [];
    window.renderBoard(allTasks);
};

window.bulkMoveToColumn = async function(newStatus) {
    if (!newStatus) return;
    const confirm = await window.customConfirm('Mover em Massa', `Mover ${selectedTaskIds.length} tarefas para "${newStatus}"?`);
    if (!confirm) return;
    
    for (const id of selectedTaskIds) {
        const task = allTasks.find(t => t.__backendId === id);
        if (task) {
            task.status = newStatus;
            await saveTasks(task);
        }
    }
    selectedTaskIds = [];
    window.renderBoard(allTasks);
    window.showToast('Tarefas movidas com sucesso!');
};

window.toggleMyTasks = function() {
    showOnlyMyTasks = !showOnlyMyTasks;
    const btn = document.getElementById('btn-filter-my');
    if (btn) {
        if (showOnlyMyTasks) {
            btn.classList.add('bg-[#FF6B8A]/20', 'border-[#FF6B8A]/50', 'text-[#FF6B8A]');
        } else {
            btn.classList.remove('bg-[#FF6B8A]/20', 'border-[#FF6B8A]/50', 'text-[#FF6B8A]');
        }
    }
    window.renderBoard(allTasks);
};

window.toggleNotifications = function() {
    const popover = document.getElementById('notif-popover');
    popover?.classList.toggle('hidden');
};

window.clearNotifications = function() {
    notifications = [];
    saveNotifications();
    updateNotificationUI();
};

window.printReport = function() {
    window.print();
};

// --- COLUNAS ---
window.promptNewColumn = async function() {
    const title = await window.customPrompt('Nova Coluna', 'Título da coluna:');
    if (!title) return;
    const id = 'col_' + Date.now();
    allColumns.push({ id, title, color: '#FF6B8A' });
    saveConfig();
    window.renderBoard(allTasks);
};

window.promptEditColumn = async function(id) {
    const col = allColumns.find(c => c.id === id);
    if (!col) return;
    const newTitle = await window.customPrompt('Editar Coluna', 'Novo título:', col.title);
    if (!newTitle) return;
    col.title = newTitle;
    saveConfig();
    window.renderBoard(allTasks);
};

window.promptDeleteColumn = async function(id) {
    const hasTasks = allTasks.some(t => t.status === id && !t.deleted);
    if (hasTasks) {
        window.showToast('Não é possível excluir uma coluna com tarefas ativas.', 'error');
        return;
    }
    const confirm = await window.customConfirm('Excluir Coluna', 'Deseja realmente excluir esta coluna?', true);
    if (!confirm) return;
    allColumns = allColumns.filter(c => c.id !== id);
    saveConfig();
    window.renderBoard(allTasks);
};

// --- FIM DO app.js ---

function updateProjectSelects() {
    const selects = document.querySelectorAll('#f-project');
    selects.forEach(s => {
        const current = s.value;
        s.innerHTML = '<option value="Geral">Geral</option>' +
            allProjects.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        s.value = current || 'Geral';
    });
}

function renderProjectsSidebar() {
    const container = document.getElementById('projects-list-container');
    if (!container) return;

    // Projeto Geral — sempre primeiro, sem ações de edição
    const geralItem = `
        <div class="group/proj flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/5 cursor-pointer ${currentProjectFilter === 'Geral' ? 'bg-white/10 text-white' : 'text-gray-400'}"
             onclick="window.filterByProject('Geral')">
            <div class="flex items-center gap-3 truncate">
                <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:#9090b0"></div>
                <span class="truncate">Geral</span>
            </div>
        </div>
    `;

    // Projetos do usuário — com ações de editar/arquivar/excluir visíveis no hover
    const projectItems = allProjects
        .filter(p => !p.archived)
        .map(p => `
        <div class="group/proj flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/5 ${currentProjectFilter === p.name ? 'bg-white/10 text-white' : 'text-gray-400'}">
            <div class="flex items-center gap-3 truncate flex-1 cursor-pointer" onclick="window.filterByProject('${p.name}')">
                <div class="w-2 h-2 rounded-full flex-shrink-0" style="background: ${p.color}"></div>
                <span class="truncate">${p.name}</span>
            </div>
            <div class="flex items-center gap-0.5 opacity-0 group-hover/proj:opacity-100 transition-opacity flex-shrink-0">
                <button onclick="event.stopPropagation(); window.promptEditProject('${p.name}')"
                    class="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-white transition-colors" title="Editar projeto">
                    <i data-lucide="edit-2" style="width:11px;height:11px"></i>
                </button>
                <button onclick="event.stopPropagation(); window.archiveProject('${p.name}')"
                    class="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-[#FFB84D] transition-colors" title="Arquivar projeto">
                    <i data-lucide="archive" style="width:11px;height:11px"></i>
                </button>
                <button onclick="event.stopPropagation(); window.promptDeleteProject('${p.name}')"
                    class="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-[#FF6B8A] transition-colors" title="Excluir projeto">
                    <i data-lucide="trash-2" style="width:11px;height:11px"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = geralItem + projectItems;
    if (window.lucide) window.lucide.createIcons({ scope: container });
}

// --- PROJETOS: EDITAR, ARQUIVAR, EXCLUIR ---

window.promptEditProject = async function(name) {
    const project = allProjects.find(p => p.name === name);
    if (!project) return;
    const newName = await window.customPrompt('Editar Projeto', 'Novo nome do projeto:', project.name);
    if (!newName || newName === project.name) return;

    // Atualiza referências nas tarefas
    allTasks.forEach(t => {
        if (t.project === project.name) t.project = newName;
    });
    project.name = newName;

    // Atualiza filtro ativo se estava filtrando por este projeto
    if (currentProjectFilter === name) currentProjectFilter = newName;

    await saveConfig();
    // Salva todas as tarefas afetadas
    const affected = allTasks.filter(t => t.project === newName);
    for (const t of affected) await saveTasks(t);

    renderProjectsSidebar();
    window.renderBoard(allTasks);
    window.showToast(`Projeto renomeado para "${newName}"!`);
};

window.archiveProject = async function(name) {
    const project = allProjects.find(p => p.name === name);
    if (!project) return;
    project.archived = true;
    if (currentProjectFilter === name) currentProjectFilter = null;
    await saveConfig();
    renderProjectsSidebar();
    window.renderBoard(allTasks);
    window.showToast(`Projeto "${name}" arquivado.`);
};

window.promptDeleteProject = async function(name) {
    const hasTasks = allTasks.some(t => t.project === name && !t.deleted);
    if (hasTasks) {
        window.showToast('Não é possível excluir um projeto com tarefas ativas.', 'error');
        return;
    }
    const confirmed = await window.customConfirm('Excluir Projeto', `Deseja excluir o projeto "${name}"?`, true);
    if (!confirmed) return;
    allProjects = allProjects.filter(p => p.name !== name);
    if (currentProjectFilter === name) currentProjectFilter = null;
    await saveConfig();
    renderProjectsSidebar();
    window.renderBoard(allTasks);
    window.showToast(`Projeto "${name}" excluído.`);
};

// Atualiza status de uma tarefa diretamente pela vista em lista
window.updateTaskStatusFromList = async function(taskId, newStatus) {
    const task = allTasks.find(t => t.__backendId === taskId);
    if (!task || task.status === newStatus) return;
    task.status = newStatus;
    await saveTasks(task);
    const col = allColumns.find(c => c.id === newStatus);
    window.showToast(`Movida para "${col?.title || newStatus}"`);
};