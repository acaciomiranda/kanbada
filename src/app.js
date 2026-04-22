/**
 * app.js
 * Lógica principal do Kanbada: Login, Filtros, Notificações, Board e Importação Robusta.
 * Versão Firebase: Sincronização em nuvem e Autenticação Segura.
 */

import { authService } from './services/auth.service.js';
import { dbService } from './services/db.service.js';

// Global Error Logging
window.onerror = function(msg, url, line, col, error) {
    console.error("Global Error Detected:", msg, "at", url, ":", line);
    alert("Erro detectado: " + msg + "\nVerifique o console (F12) para detalhes.");
    return false;
};

window.onunhandledrejection = function(event) {
    console.error("Unhandled Promise Rejection:", event.reason);
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
    const saved = localStorage.getItem(`kanbada_notifications_${currentUser.uid}`);
    if (saved) {
        notifications = JSON.parse(saved);
        updateNotificationUI();
    }
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
    updateAvatars();
    renderProjectsSidebar();
    updateProjectSelects();
    await loadTasks();
    loadNotifications();

    window.showToast(`Sessão ativa: ${currentUser.name}`);
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

window.handleAsanaImport = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    window.showToast('Processando arquivo...');

    if (fileType === 'csv') {
        // Processar CSV
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
        document.getElementById('import-modal-msg').innerHTML =
            `O arquivo contém <strong>${newTasks.length}</strong> tarefas.<br>Detectamos <strong>${duplicates.length}</strong> duplicatas.<br><br>Como deseja prosseguir?`;
        document.getElementById('import-modal').classList.remove('hidden');
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
        await dbService.batchSaveTasks(currentUser.uid, tasks);
        allTasks = [...allTasks, ...tasks];
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

function cleanupRecycleBin() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const initialLen = allTasks.length;
    allTasks = allTasks.filter(t => {
        if (t.deleted && t.deletedAt) {
            const delDate = new Date(t.deletedAt).getTime();
            return delDate > sevenDaysAgo;
        }
        return true;
    });
    if (allTasks.length !== initialLen) saveTasks();
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

window.renderBoard = function (data) {
    cleanupRecycleBin();
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
        renderListView(filtered);
        updateBulkBar();
        return;
    }

    let colsToRender = [];
    if (viewMode === 'board') {
        colsToRender = allColumns;
        if (boardTitle) boardTitle.textContent = 'Quadro de Tarefas';
    } else if (viewMode === 'archive') {
        const archivedProjects = [...new Set(filtered.map(t => t.project || 'Geral'))];
        const knownProjects = new Set(['Geral', ...allProjects.map(p => p.name)]);
        const extraProjects = archivedProjects.filter(p => !knownProjects.has(p));

        colsToRender = [
            { id: 'proj_Geral', title: 'Geral', color: '#9090b0', filterKey: 'Geral' },
            ...allProjects.map(p => ({ id: 'proj_' + p.name.replace(/\s+/g, '_'), title: p.name, color: p.color, filterKey: p.name })),
            ...extraProjects.map(p => ({ id: 'proj_extra_' + p.replace(/\s+/g, '_'), title: p, color: '#6a6a8e', filterKey: p }))
        ];
        if (boardTitle) boardTitle.textContent = 'Arquivo (Por Projeto)';
    } else if (viewMode === 'recycle') {
        colsToRender = [{ id: 'lixeira', title: 'Lixeira (Últimos 7 dias)', color: '#FF6B8A' }];
        if (boardTitle) boardTitle.textContent = 'Reciclagem';
    }

    const container = document.getElementById('kanban-board-container');
    if (container) {
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
        else if (viewMode === 'archive') tasks = filtered.filter(t => t.project === col.filterKey);
        else if (viewMode === 'recycle') tasks = filtered;

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
        alert('Não é possível excluir uma coluna que contém tarefas ativas.');
        return;
    }
    const confirm = await window.customConfirm('Excluir Coluna', 'Deseja realmente excluir esta coluna?', true);
    if (!confirm) return;
    allColumns = allColumns.filter(c => c.id !== id);
    saveConfig();
    window.renderBoard(allTasks);
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired. Starting checkAuth...");
    checkAuth();

    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        window.renderBoard(allTasks);
    });
    
    initSidebarListeners();
});

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
    container.innerHTML = allProjects.map(p => `
        <div class="group flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/5 cursor-pointer ${currentProjectFilter === p.name ? 'bg-white/10 text-white' : 'text-gray-400'}" 
             onclick="window.filterByProject('${p.name}')">
            <div class="flex items-center gap-3 truncate">
                <div class="w-2 h-2 rounded-full flex-shrink-0" style="background: ${p.color}"></div>
                <span class="truncate">${p.name}</span>
            </div>
        </div>
    `).join('');
}