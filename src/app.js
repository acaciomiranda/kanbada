/**
 * app.js
 * Lógica principal do Kanbada: Login, Filtros, Notificações, Board e Importação Robusta.
 * Versão Corrigida com Persistência e Validações
 */

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

// --- FILTROS ---
function getVisibleTasks(data) {
    let filtered = data;
    
    if (viewMode === 'board' || viewMode === 'list') {
        filtered = filtered.filter(t => !t.deleted && !t.archived);
        if (currentProjectFilter) {
            filtered = filtered.filter(t => t.project === currentProjectFilter);
        }
        if (showOnlyMyTasks && currentUser) {
            filtered = filtered.filter(t => t.assignee === currentUser.name);
        }
    } else if (viewMode === 'archive') {
        filtered = filtered.filter(t => t.archived && !t.deleted);
    } else if (viewMode === 'recycle') {
        filtered = filtered.filter(t => t.deleted);
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(t => 
            t.title.toLowerCase().includes(lower) || 
            (t.description && t.description.toLowerCase().includes(lower))
        );
    }

    return filtered;
}

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

// --- PERSISTÊNCIA DE DADOS ---
function saveTasks() {
    try {
        localStorage.setItem('kanbada_tasks', JSON.stringify(allTasks));
    } catch (e) {
        console.error('Erro ao salvar tarefas:', e);
        window.showToast('Erro ao salvar. Espaço insuficiente?', 'error');
    }
}

function loadTasks() {
    try {
        const saved = localStorage.getItem('kanbada_tasks');
        if (saved) {
            allTasks = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Erro ao carregar tarefas:', e);
        allTasks = [];
    }
    window.renderBoard(allTasks); // Sempre renderiza (mesmo quadro vazio)
}

function saveNotifications() {
    localStorage.setItem('kanbada_notifications', JSON.stringify(notifications));
}

function loadNotifications() {
    const saved = localStorage.getItem('kanbada_notifications');
    if (saved) {
        notifications = JSON.parse(saved);
        updateNotificationUI();
    }
}

function saveConfig() {
    localStorage.setItem('kanbada_projects', JSON.stringify(allProjects));
    localStorage.setItem('kanbada_columns', JSON.stringify(allColumns));
}

function loadConfig() {
    const savedProjects = localStorage.getItem('kanbada_projects');
    const savedColumns = localStorage.getItem('kanbada_columns');

    if (savedProjects) {
        const parsed = JSON.parse(savedProjects);
        // Migração: se for array de strings, converte para objetos com cores padrão
        allProjects = parsed.map(p => typeof p === 'string' ? { name: p, color: '#6C63FF' } : p);
    }
    if (savedColumns) allColumns = JSON.parse(savedColumns);
}

// --- UTILITÁRIOS ---
window.showToast = function(msg, type = 'success') {
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

// --- AUTH ---
function checkAuth() {
    const saved = localStorage.getItem('kanbada_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        showApp();
    } else {
        hideApp();
    }
}

function showApp() {
    document.getElementById('login-root').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    updateAvatars();
    loadConfig();
    renderProjectsSidebar();
    updateProjectSelects();
    loadTasks();        // renderBoard é chamado dentro de loadTasks quando há dados
    loadNotifications();
    window.showToast(`Bem-vindo, ${currentUser.name}!`);
}

function hideApp() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-root').classList.remove('hidden');
    if (window.renderLogin) window.renderLogin();
}

window.onLoginSuccess = (u) => {
    currentUser = u;
    showApp();
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
window.logout = function() {
    if (!confirm('Deseja realmente sair? Suas tarefas estão salvas.')) return;
    localStorage.removeItem('kanbada_user');
    currentUser = null;
    hideApp();
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

window.handleAsanaImport = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    window.showToast('Processando arquivo...');

    if (fileType === 'csv') {
        // Processar CSV
        const reader = new FileReader();
        reader.onload = function(evt) {
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
        reader.onload = function(evt) {
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

window.confirmImport = function(mode) {
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

function completeImport(tasks) {
    allTasks = [...allTasks, ...tasks];
    saveTasks();
    window.renderBoard(allTasks);
    window.showToast(`${tasks.length} tarefas importadas!`);
    addNotification(`${tasks.length} tarefas importadas.`);
}

// --- GOOGLE SHEETS IMPORT ---
window.importGoogleSheets = function() {
    const url = prompt('Cole o link público do Google Sheets:');
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
window.exportTasks = function() {
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

window.renderBoard = function(data) {
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

window.clearFilters = function() {
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
window.showReports = function() {
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
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = activeTasks.filter(t => {
        if (!t.due_date || t.status === lastCol?.id) return false;
        const d = new Date(t.due_date); d.setHours(0,0,0,0);
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
    const topAssignees = Object.entries(byAssignee).sort((a,b) => b[1]-a[1]).slice(0,5);

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

    const projectRows = Object.entries(byProject).sort((a,b) => b[1].total-a[1].total).map(([name, data]) => {
        const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
        return `
        <div class="flex items-center justify-between py-2" style="border-bottom:1px solid #2a2a44">
            <span class="text-xs text-gray-300 truncate flex-1 mr-4">${name}</span>
            <div class="flex items-center gap-3">
                <div class="rounded-full overflow-hidden" style="width:80px;height:4px;background:#2a2a44">
                    <div class="h-full rounded-full" style="width:${pct}%;background:#00C9A7"></div>
                </div>
                <span class="text-xs font-mono" style="color:#9090b0;min-width:40px;text-align:right">${data.done}/${data.total}</span>
                <span class="text-xs font-bold" style="color:${pct===100?'#00C9A7':'#9090b0'};min-width:36px;text-align:right">${pct}%</span>
            </div>
        </div>`;
    }).join('');

    const assigneeRows = topAssignees.map(([name, count]) => `
        <div class="flex items-center gap-2 py-1.5">
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style="background:linear-gradient(135deg,#FF6B8A,#c850c0)">
                ${name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
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
                <p class="text-2xl font-bold" style="color:${completionRate>=75?'#00C9A7':completionRate>=40?'#FFB84D':'#FF6B8A'}">${completionRate}%</p>
            </div>
            <div class="p-4 rounded-xl" style="background:#12121f;border:1px solid #2a2a44">
                <p class="text-[10px] uppercase tracking-wider mb-1" style="color:#6a6a8e">Atrasadas</p>
                <p class="text-2xl font-bold" style="color:${overdue>0?'#FF6B8A':'#9090b0'}">${overdue}</p>
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
            <span>📁 Arquivadas: ${allTasks.filter(t=>t.archived&&!t.deleted).length}</span>
            <span>🗑️ Na lixeira: ${allTasks.filter(t=>t.deleted).length}</span>
            <span>📅 Sem prazo: ${noDate}</span>
        </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons({ scope: content });
};

window.closeReportsModal = function() {
    document.getElementById('reports-modal').classList.add('hidden');
};

// --- APP INIT & LISTENERS ---
function initSidebarListeners() {
    document.getElementById('nav-home').addEventListener('click', () => {
        viewMode = 'board';
        const bt = document.getElementById('board-title');
        if (bt) bt.textContent = 'Quadro de Tarefas';
        window.clearFilters();
    });
    
    document.getElementById('nav-my-tasks').addEventListener('click', (e) => {
        viewMode = 'board';
        const bt = document.getElementById('board-title');
        if (bt) bt.textContent = 'Quadro de Tarefas';
        document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        showOnlyMyTasks = true;
        currentProjectFilter = null;
        window.renderBoard(allTasks);
    });
    
    document.getElementById('nav-reports').addEventListener('click', (e) => {
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

function addNotification(text) {
    notifications.unshift({
        id: Date.now(),
        text,
        date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    
    // Limita a 50 notificações
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    
    updateNotificationUI();
    saveNotifications();
    document.getElementById('noti-badge').classList.remove('hidden');
}

function updateNotificationUI() {
    const list = document.getElementById('noti-list');
    if (!list) return;
    
    if (notifications.length === 0) {
        list.innerHTML = `<div class="p-4 text-center italic text-xs text-gray-500">Sem notificações</div>`;
        return;
    }
    
    list.innerHTML = notifications.map(n => 
        `<div class="p-3 border-b border-[#2a2a44] hover:bg-white/5 transition-colors">
            <p class="text-[11px] text-gray-300">${n.text}</p>
            <p class="text-[9px] mt-1 text-gray-500">${n.date}</p>
        </div>`
    ).join('');
}

window.clearNotifications = function() {
    if (notifications.length === 0) return;
    if (confirm('Deseja limpar todas as notificações?')) {
        notifications = [];
        updateNotificationUI();
        saveNotifications();
        window.showToast('Notificações limpas');
    }
};

function initNotificationListeners() {
    document.getElementById('noti-bell')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('notification-dropdown').classList.toggle('hidden');
        document.getElementById('noti-badge').classList.add('hidden');
    });
    
    document.addEventListener('click', () => {
        document.getElementById('notification-dropdown').classList.add('hidden');
    });
    
    document.getElementById('notification-dropdown')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// --- MODAL & ACTIONS ---
window.openModal = function(statusOrId = null, secondArg = null) {
    const modal = document.getElementById('modal-overlay');
    const form = document.getElementById('task-form');
    const modalTitle = document.getElementById('modal-title');
    if (!modal || !form) return;

    form.reset();
    currentEditingSubtasks = [];
    editingTaskId = null;

    // Se houver um segundo argumento, ele é o ID (caso da renderListView). 
    // Senão, o primeiro argumento pode ser o ID.
    const idToFind = secondArg || statusOrId;
    const task = allTasks.find(t => t.__backendId.toString() === (idToFind || '').toString());
    
    if (task) {
        editingTaskId = task.__backendId;
        modalTitle.textContent = 'Editar Tarefa';
        document.getElementById('f-title').value = task.title || '';
        document.getElementById('f-date').value = task.due_date || '';
        document.getElementById('f-assignee').value = task.assignee || '';
        document.getElementById('f-project').value = task.project || 'Geral';
        document.getElementById('f-tag').value = task.tag || '';
        document.getElementById('f-tagcolor').value = task.tag_color || '#FF6B8A';
        document.getElementById('f-description').value = task.description || '';
        document.getElementById('f-status').value = task.status || (allColumns[0] ? allColumns[0].id : '');
        document.getElementById('submit-btn').textContent = 'Salvar Alterações';
        currentEditingSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
    } else {
        // Nova tarefa
        modalTitle.textContent = 'Nova Tarefa';
        document.getElementById('submit-btn').textContent = 'Adicionar Tarefa';
        const colId = (statusOrId && allColumns.some(c => c.id === statusOrId)) ? statusOrId : (allColumns[0] ? allColumns[0].id : '');
        document.getElementById('f-status').value = colId;
        document.getElementById('f-project').value = currentProjectFilter || 'Geral';
    }

    renderSubtasks();
    modal.classList.remove('hidden');
};

window.closeModal = function() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.add('hidden');
    editingTaskId = null;
};

window.editTask = function(id) {
    window.openModal(id);
};

window.archiveTask = function(id) {
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        task.archived = true;
        saveTasks();
        window.renderBoard(allTasks);
        window.showToast('Tarefa arquivada!');
    }
};

window.restoreTask = function(id) {
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        task.archived = false;
        task.deleted = false;
        saveTasks();
        window.renderBoard(allTasks);
        window.showToast('Tarefa restaurada!');
    }
};

window.toggleDelete = function(id) {
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        if (task.deleted) {
            window.deleteTaskPermanently(id);
        } else {
            task.deleted = true;
            task.archived = false;
            task.deletedAt = new Date().toISOString();
            saveTasks();
            window.renderBoard(allTasks);
            window.showToast('Tarefa movida para a lixeira!');
        }
    }
};

window.deleteTaskPermanently = async function(id) {
    if (!(await window.customConfirm('Excluir Definitivamente', 'Esta ação não pode ser desfeita. Deseja continuar?', true))) return;
    
    allTasks = allTasks.filter(t => t.__backendId.toString() !== id.toString());
    saveTasks();
    window.renderBoard(allTasks);
    window.showToast('Tarefa excluída permanentemente!');
};

// --- SUBTASKS ---
window.addSubtask = function() {
    const input = document.getElementById('new-subtask-input');
    if (!input || !input.value.trim()) return;
    currentEditingSubtasks.push({ id: Date.now(), text: input.value.trim(), completed: false });
    input.value = '';
    renderSubtasks();
};

window.toggleSubtask = function(id) {
    const st = currentEditingSubtasks.find(s => s.id === id);
    if (st) st.completed = !st.completed;
    renderSubtasks();
};

window.removeSubtask = function(id) {
    currentEditingSubtasks = currentEditingSubtasks.filter(s => s.id !== id);
    renderSubtasks();
};

window.toggleTaskSubtask = function(taskId, subtaskId, event) {
    if (event) event.stopPropagation();
    const task = allTasks.find(t => t.__backendId.toString() === taskId.toString());
    if (task && task.subtasks) {
        const st = task.subtasks.find(s => s.id.toString() === subtaskId.toString());
        if (st) {
            st.completed = !st.completed;
            saveTasks();
            window.renderBoard(allTasks);
        }
    }
};

function renderSubtasks() {
    const container = document.getElementById('subtasks-container');
    const progress = document.getElementById('subtask-progress');
    if (!container) return;
    
    container.innerHTML = currentEditingSubtasks.map(s => `
        <div class="flex items-center gap-2 bg-[#12121f] p-2 rounded-lg border border-[#2a2a44] group">
            <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="window.toggleSubtask(${s.id})"
                class="rounded border-[#2a2a44] bg-[#1e1e36] text-[#FF6B8A] focus:ring-[#FF6B8A]">
            <span class="text-xs flex-1 ${s.completed ? 'line-through text-[#9090b0]' : 'text-[#e0e0ec]'}">${s.text}</span>
            <button type="button" onclick="window.removeSubtask(${s.id})" class="opacity-0 group-hover:opacity-100 text-[#FF6B8A] p-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    `).join('');
    
    const done = currentEditingSubtasks.filter(s => s.completed).length;
    if (progress) progress.textContent = `${done}/${currentEditingSubtasks.length}`;
    if (window.lucide) window.lucide.createIcons({ scope: container });
}

// --- SUBMIT ---
window.handleSubmit = function(e) {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    if (!title) {
        window.showToast('Título é obrigatório!', 'error');
        return;
    }

    const taskData = {
        title: title,
        due_date: document.getElementById('f-date').value || null,
        assignee: document.getElementById('f-assignee').value.trim() || 'Usuário',
        project: document.getElementById('f-project').value || 'Geral',
        tag: document.getElementById('f-tag').value.trim() || '',
        tag_color: document.getElementById('f-tagcolor').value,
        description: document.getElementById('f-description').value,
        status: document.getElementById('f-status').value,
        subtasks: [...currentEditingSubtasks],
        updatedAt: new Date().toISOString()
    };

    if (editingTaskId) {
        const index = allTasks.findIndex(t => t.__backendId.toString() === editingTaskId.toString());
        if (index > -1) {
            allTasks[index] = { ...allTasks[index], ...taskData };
            window.showToast('Tarefa atualizada!');
        }
    } else {
        const newTask = {
            ...taskData,
            __backendId: Date.now().toString(),
            createdAt: new Date().toISOString(),
            archived: false,
            deleted: false,
            reactions: { thumbsUp: 0, heart: 0 }
        };
        allTasks.push(newTask);
        window.showToast('Tarefa criada!');
    }

    saveTasks();
    window.closeModal();
    window.renderBoard(allTasks);
};

// --- PROJETOS ---
function renderProjectsSidebar() {
    const container = document.getElementById('project-list-sidebar');
    if (!container) return;

    let html = `
        <div class="project-item flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer ${currentProjectFilter === 'Geral' ? 'bg-white/5' : 'hover:bg-white/5'}" data-project="Geral">
            <span style="width:8px;height:8px;border-radius:50%;background:#e0e0ec"></span>
            <span class="text-sm font-medium ${currentProjectFilter === 'Geral' ? 'text-white' : 'text-[#9090b0]'}">Geral</span>
        </div>
    `;

    html += allProjects.map(p => `
        <div class="project-item group flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer ${currentProjectFilter === p.name ? 'bg-white/5' : 'hover:bg-white/5'}" data-project="${p.name}">
            <div class="flex items-center gap-3 truncate">
                <span style="width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                <span class="text-sm font-medium ${currentProjectFilter === p.name ? 'text-white' : 'text-[#9090b0]'} truncate">${p.name}</span>
            </div>
            <button onclick="event.stopPropagation(); window.promptEditProject('${p.name}')" 
                class="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white transition-all">
                <i data-lucide="settings" class="w-3 h-3"></i>
            </button>
        </div>
    `).join('');
    
    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ scope: container });
    
    document.querySelectorAll('.project-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const project = e.currentTarget.dataset.project;
            currentProjectFilter = (currentProjectFilter === project) ? null : project;
            renderProjectsSidebar();
            window.renderBoard(allTasks);
        });
    });
}

window.promptEditProject = async function(oldName) {
    const proj = allProjects.find(p => p.name === oldName);
    if (!proj) return;

    const newName = await window.customPrompt('Editar Projeto', 'Nome do projeto:', oldName);
    if (!newName) return;

    const colors = ['#FF6B8A', '#6C63FF', '#00C9A7', '#FFB84D', '#4DA8FF', '#FF5733', '#C70039'];
    const colorHtml = colors.map(c => `
        <button onclick="document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('ring-2','ring-white')); this.classList.add('ring-2','ring-white')" 
            class="color-opt w-8 h-8 rounded-full transition-all ${c === proj.color ? 'ring-2 ring-white' : ''}" 
            style="background:${c}" data-color="${c}"></button>
    `).join('');

    await window.customPrompt('Cor do Projeto', `Cor para "${newName}":<div class="flex flex-wrap gap-2 mt-4">${colorHtml}</div>`);
    
    const selectedBtn = document.querySelector('.color-opt.ring-2');
    const finalColor = selectedBtn ? selectedBtn.dataset.color : proj.color;

    allTasks.forEach(t => { if (t.project === oldName) t.project = newName; });
    proj.name = newName;
    proj.color = finalColor;

    saveConfig();
    saveTasks();
    renderProjectsSidebar();
    updateProjectSelects();
    window.renderBoard(allTasks);
    window.showToast('Projeto atualizado!');
};

function updateProjectSelects() {
    const projSelects = document.querySelectorAll('select#f-project, select#bulk-project-select');
    const projOptionsHtml = `<option value="Geral">Geral</option>` + allProjects.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    projSelects.forEach(s => {
        const val = s.value;
        s.innerHTML = projOptionsHtml;
        if (val) s.value = val;
    });

    const statusSelects = document.querySelectorAll('select#f-status');
    const statusOptionsHtml = allColumns.map(col => `<option value="${col.id}">${col.title}</option>`).join('');
    statusSelects.forEach(s => {
        const val = s.value;
        s.innerHTML = statusOptionsHtml;
        if (val) s.value = val;
    });
}

window.promptNewProject = async function() {
    const name = await window.customPrompt('Novo Projeto', 'Digite o nome do projeto:');
    if (name && name.trim()) {
        const trimmed = name.trim();
        if (!allProjects.find(p => p.name === trimmed)) {
            const colors = ['#FF6B8A', '#6C63FF', '#00C9A7', '#FFB84D', '#4DA8FF'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            allProjects.push({ name: trimmed, color });
            saveConfig();
            renderProjectsSidebar();
            updateProjectSelects();
            window.showToast(`Projeto "${trimmed}" criado!`);
        }
    }
};

window.promptNewColumn = async function() {
    const title = await window.customPrompt('Nova Coluna', 'Digite o nome da coluna:');
    if (title && title.trim()) {
        const trimmed = title.trim();
        const id = 'col_' + Date.now();
        allColumns.push({ id, title: trimmed, color: '#6C63FF' });
        saveConfig();
        window.renderBoard(allTasks);
        window.showToast('Coluna criada!');
    }
};

window.reactToTask = function(id, type, event) {
    if(event) event.stopPropagation();
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        if (!task.reactions) task.reactions = { thumbsUp: 0, heart: 0 };
        task.reactions[type] = (task.reactions[type] || 0) + 1;
        saveTasks();
        window.renderBoard(allTasks);
    }
};

window.changeTaskStatus = function(id, newStatus, event) {
    if(event) event.stopPropagation();
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task && newStatus) {
        task.status = newStatus;
        saveTasks();
        window.renderBoard(allTasks);
    }
};

// --- AÇÕES EM MASSA ---
window.toggleTaskSelection = function(id, event) {
    if (window.selectedTaskIds.includes(id)) {
        window.selectedTaskIds = window.selectedTaskIds.filter(tid => tid !== id);
    } else {
        window.selectedTaskIds = [...window.selectedTaskIds, id];
    }
    window.renderBoard(allTasks);
};

window.clearSelection = function() {
    window.selectedTaskIds = [];
    window.renderBoard(allTasks);
};

window.bulkSelectAll = function() {
    // Seleciona apenas as tarefas visíveis no modo atual
    const visibleTasks = getVisibleTasks();
    window.selectedTaskIds = visibleTasks.map(t => t.__backendId);
    window.renderBoard(allTasks);
};

// Move todas as tarefas selecionadas para uma coluna
window.bulkMoveToColumn = function(columnId) {
    if (window.selectedTaskIds.length === 0) return;
    const col = allColumns.find(c => c.id === columnId);
    if (!col) return;

    let moved = 0;
    window.selectedTaskIds.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task && !task.deleted && !task.archived) {
            task.status = columnId;
            moved++;
        }
    });

    if (moved === 0) {
        window.showToast('Nenhuma tarefa ativa foi movida.', 'error');
        return;
    }

    window.selectedTaskIds = [];
    saveTasks();
    window.renderBoard(allTasks);
    window.showToast(`${moved} tarefa(s) movida(s) para "${col.title}"!`);
};

// Arquiva todas as tarefas selecionadas em massa
window.bulkArchive = function() {
    if (window.selectedTaskIds.length === 0) return;

    let archived = 0;
    window.selectedTaskIds.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task && !task.deleted && !task.archived) {
            task.archived = true;
            archived++;
        }
    });

    window.selectedTaskIds = [];
    saveTasks();
    window.renderBoard(allTasks);
    window.showToast(`${archived} tarefa(s) arquivada(s)!`);
};

window.bulkDelete = function() {
    if (window.selectedTaskIds.length === 0) return;
    if (!confirm(`Deseja realmente excluir ${window.selectedTaskIds.length} tarefas selecionadas?`)) return;

    window.selectedTaskIds.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task) {
            if (task.deleted) {
                const idx = allTasks.indexOf(task);
                allTasks.splice(idx, 1);
            } else {
                task.deleted = true;
                task.archived = false;
                task.deletedAt = new Date().toISOString();
            }
        }
    });

    window.selectedTaskIds = [];
    saveTasks();
    window.renderBoard(allTasks);
    window.showToast('Tarefas excluídas com sucesso!');
};

window.bulkMoveToColumn = function(colId) {
    if (window.selectedTaskIds.length === 0) return;
    const col = allColumns.find(c => c.id === colId);
    if (!col) return;

    let moved = 0;
    window.selectedTaskIds.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task && task.status !== colId) {
            task.status = colId;
            moved++;
        }
    });

    window.selectedTaskIds = [];
    saveTasks();
    window.renderBoard(allTasks);
    window.showToast(`${moved} tarefas movidas para "${col.title}"!`);
};

window.toggleTaskSelection = function(id, event) {
    if (event) event.stopPropagation();
    const idx = window.selectedTaskIds.indexOf(id);
    if (idx > -1) {
        window.selectedTaskIds.splice(idx, 1);
    } else {
        window.selectedTaskIds.push(id);
    }
    updateBulkBar();
    // Renderização parcial apenas se necessário, mas renderBoard é mais seguro
    window.renderBoard(allTasks); 
};

window.clearSelection = function() {
    window.selectedTaskIds = [];
    window.renderBoard(allTasks);
};

window.selectAll = function() {
    const visible = getVisibleTasks(allTasks);
    window.selectedTaskIds = visible.map(t => t.__backendId);
    window.renderBoard(allTasks);
};

// --- VISTA EM LISTA ---
function renderListView(tasks) {
    const container = document.getElementById('kanban-board-container');
    if (!container) return;

    let html = `
        <div class="list-view-container w-full h-fit bg-[#1e1e36] rounded-xl border border-[#2a2a44] overflow-hidden">
            <table class="list-table">
                <thead><tr>
                    <th class="w-10"></th><th>Título</th><th>Status</th><th>Projeto</th><th>Responsável</th><th>Subtarefas</th><th>Data</th>
                </tr></thead>
                <tbody>
    `;

    if (tasks.length === 0) {
        html += `<tr><td colspan="7" class="text-center py-10 text-[#9090b0]">Nenhuma tarefa encontrada</td></tr>`;
    } else {
        html += tasks.map(t => {
            const status = allColumns.find(c => c.id === t.status);
            const project = allProjects.find(p => p.name === t.project);
            const subtasks = t.subtasks || [];
            const done = subtasks.filter(s => s.completed).length;
            const isSelected = window.selectedTaskIds.includes(t.__backendId);
            return `
                <tr class="list-row ${isSelected ? 'selected' : ''}" onclick="window.openModal(null, '${t.__backendId}')">
                    <td onclick="event.stopPropagation()">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.toggleTaskSelection('${t.__backendId}')"
                            class="rounded border-[#2a2a44] bg-[#12121f] text-[#FF6B8A] focus:ring-[#FF6B8A]">
                    </td>
                    <td class="font-bold text-white">${t.title}</td>
                    <td><span class="list-status-pill" style="background:${status?.color || '#666'}20; color:${status?.color || '#666'}">${status?.title || '-'}</span></td>
                    <td><div class="flex items-center gap-2"><span style="width:6px;height:6px;border-radius:50%;background:${project?.color || '#9090b0'}"></span>${t.project || 'Geral'}</div></td>
                    <td>${t.assignee || '-'}</td>
                    <td>${subtasks.length > 0 ? `<span class="${done === subtasks.length ? 'text-[#00C9A7]' : 'text-[#FF6B8A]'} font-bold">${done}/${subtasks.length}</span>` : '-'}</td>
                    <td class="text-[#9090b0] text-[11px]">${t.due_date || '-'}</td>
                </tr>
            `;
        }).join('');
    }
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

window.setViewMode = function(mode) {
    viewMode = mode;
    const boardBtn = document.getElementById('view-board-btn');
    const listBtn = document.getElementById('view-list-btn');
    if (boardBtn && listBtn) {
        const activeClass = 'bg-[#FF6B8A]/10 text-[#FF6B8A]';
        if (mode === 'board') {
            boardBtn.className = `p-1.5 rounded-md transition-all active:scale-95 ${activeClass}`;
            listBtn.className = `p-1.5 rounded-md transition-all active:scale-95 text-[#9090b0] hover:text-white`;
        } else if (mode === 'list') {
            listBtn.className = `p-1.5 rounded-md transition-all active:scale-95 ${activeClass}`;
            boardBtn.className = `p-1.5 rounded-md transition-all active:scale-95 text-[#9090b0] hover:text-white`;
        }
    }
    window.renderBoard(allTasks);
};

window.bulkSelectStatus = function(statusId) {
    const tasksInStatus = allTasks.filter(t => t.status === statusId && !t.archived && !t.deleted);
    const allInStatusSelected = tasksInStatus.every(t => window.selectedTaskIds.includes(t.__backendId));
    
    if (allInStatusSelected) {
        tasksInStatus.forEach(t => {
            window.selectedTaskIds = window.selectedTaskIds.filter(id => id !== t.__backendId);
        });
    } else {
        tasksInStatus.forEach(t => {
            if (!window.selectedTaskIds.includes(t.__backendId)) window.selectedTaskIds.push(t.__backendId);
        });
    }
    window.renderBoard(allTasks);
};

function updateBulkBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const countSpan = document.getElementById('selected-count');
    const selectDropdown = document.getElementById('bulk-select-dropdown');
    const moveDropdown = document.getElementById('bulk-move-dropdown');

    if (!bar || !countSpan) return;

    if (window.selectedTaskIds.length > 0) {
        bar.classList.remove('hidden');
        const n = window.selectedTaskIds.length;
        countSpan.textContent = `${n} selecionada${n > 1 ? 's' : ''}`;

        // Preenche dropdown "Selecionar por Status"
        if (selectDropdown) {
            selectDropdown.innerHTML = allColumns.map(col => `
                <button onclick="window.bulkSelectStatus('${col.id}')"
                    class="w-full text-left px-4 py-2 text-[11px] text-gray-300 hover:bg-white/5 hover:text-[#FF6B8A] transition-colors flex items-center gap-2">
                    <span style="width:6px;height:6px;border-radius:50%;background:${col.color};flex-shrink:0"></span>
                    ${col.title}
                </button>
            `).join('');
        }

        // Preenche dropdown "Mover para..."
        if (moveDropdown) {
            moveDropdown.innerHTML = allColumns.map(col => `
                <button onclick="window.bulkMoveToColumn('${col.id}')"
                    class="w-full text-left px-4 py-2 text-[11px] text-gray-300 hover:bg-white/5 hover:text-[#FF6B8A] transition-colors flex items-center gap-2">
                    <span style="width:6px;height:6px;border-radius:50%;background:${col.color};flex-shrink:0"></span>
                    ${col.title}
                </button>
            `).join('');
        }
    } else {
        bar.classList.add('hidden');
    }
}

// --- START APP ---
let sortableInstances = [];

function initSortable() {
    if (viewMode !== 'board') return; 
    
    // Limpa instâncias anteriores para evitar memory leaks
    sortableInstances.forEach(inst => inst.destroy());
    sortableInstances = [];
    
    allColumns.forEach(col => {
        const el = document.getElementById(`col-${col.id}`);
        if (el) {
            const inst = Sortable.create(el, {
                group: 'kanban',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: (evt) => {
                    const taskId = evt.item.dataset.id;
                    const newStatus = evt.to.id.replace('col-', '');
                    const task = allTasks.find(t => t.__backendId.toString() === taskId.toString());
                    
                    if (task) {
                        const oldStatus = task.status;
                        task.status = newStatus;
                        
                        saveTasks();
                        window.renderBoard(allTasks);
                        
                        const isLastCol = allColumns[allColumns.length - 1].id === newStatus;
                        if (isLastCol && oldStatus !== newStatus) {
                            addNotification(`✅ Tarefa "${task.title}" finalizada!`);
                        }
                    }
                }
            });
            sortableInstances.push(inst);
        }
    });
}

// --- TOAST ---
window.showToast = function(msg, type = 'default') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    // Remove classes anteriores
    t.classList.remove('toast-success', 'toast-error', 'toast-default', 'hidden');
    t.classList.add('toast-' + type);
    // Limpa style inline legado
    t.style.background = '';

    clearTimeout(t._toastTimer);
    t._toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
};

// --- ATALHOS DE TECLADO ---
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC - Fechar modais
        if (e.key === 'Escape') {
            window.closeModal();
            document.getElementById('import-modal').classList.add('hidden');
            document.getElementById('reports-modal')?.classList.add('hidden');
            window.closeSidebar();
        }
        
        // Ctrl/Cmd + N - Nova tarefa
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            window.openModal('plan');
        }
        
        // Ctrl/Cmd + K - Busca
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('search-input').focus();
        }
        
        // Ctrl/Cmd + E - Exportar
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            window.exportTasks();
        }
    });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSidebarListeners();
    initNotificationListeners();
    initKeyboardShortcuts();
    
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        window.renderBoard(allTasks);
    });
    
    initSortable();
    initMobileSidebarClose(); // Garante que itens do menu fecham a sidebar no mobile
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// --- SIDEBAR MOBILE ---
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
        window.closeSidebar();
    } else {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
};

// Fecha sidebar ao clicar num item de navegação no mobile
function initMobileSidebarClose() {
    const sidebarItems = document.querySelectorAll('.sidebar-item, .project-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 1024) window.closeSidebar();
        });
    });
}

// --- EXPORTAR CSV ---
window.exportTasksCSV = function() {
    const activeTasks = allTasks.filter(t => !t.deleted);
    if (activeTasks.length === 0) {
        window.showToast('Nenhuma tarefa para exportar.', 'error');
        return;
    }

    // Cabeçalho compatível com Asana + Status
    const headers = ['Name', 'Section/Column', 'Status', 'Assignee', 'Due Date', 'Project', 'Notes', 'Tags'];
    const colTitle = (id) => {
        const col = allColumns.find(c => c.id === id);
        return col ? col.title : id;
    };

    const rows = activeTasks.map(t => [
        (t.title || '').replace(/,/g, ';'),
        colTitle(t.status),
        t.archived ? 'Arquivada' : 'Ativa',
        (t.assignee || '').replace(/,/g, ';'),
        t.due_date || '',
        (t.project || 'Geral').replace(/,/g, ';'),
        (t.description || '').replace(/,/g, ';').replace(/\n/g, ' '),
        (t.tag || '').replace(/,/g, ';')
    ]);

    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `kanbada_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    window.showToast(`${activeTasks.length} tarefas exportadas em CSV!`);
};

// --- MODAL DE PROMPT/CONFIRM CUSTOMIZADO ---
window.validateFileSize = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const maxSize = 1024 * 1024 * 1024; // 1GB
        if (file.size > maxSize) {
            window.showToast('Arquivo muito grande! Máximo 1GB.', 'error');
            input.value = '';
            return;
        }
        document.getElementById('f-filename').value = file.name;
    }
};

window.downloadAttachment = function(id) {
    window.showToast('Iniciando download...');
    // Simulação de download para o MVP
    setTimeout(() => {
        window.showToast('Download concluído!');
    }, 1000);
};

window.customPrompt = function(title, message, defaultValue = '', options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const container = document.getElementById('prompt-modal-container');
        const titleEl = document.getElementById('prompt-modal-title');
        const msgEl = document.getElementById('prompt-modal-message');
        const input = document.getElementById('prompt-modal-input');
        const cancelBtn = document.getElementById('prompt-modal-cancel');
        const confirmBtn = document.getElementById('prompt-modal-confirm');
        const inputWrapper = document.getElementById('prompt-input-wrapper');
        const iconContainer = document.getElementById('prompt-icon-container');

        titleEl.textContent = title;
        msgEl.textContent = message;
        input.value = defaultValue;
        inputWrapper.classList.toggle('hidden', options.noInput);
        
        if (options.isDelete) {
            confirmBtn.className = "px-6 py-2 bg-[#FF6B8A] hover:bg-pink-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-500/20 transition-all active:scale-95";
            iconContainer.className = "p-2 rounded-lg bg-[#FF6B8A]/10 text-[#FF6B8A]";
            iconContainer.innerHTML = '<i data-lucide="trash-2" class="w-5 h-5"></i>';
        } else {
            confirmBtn.className = "px-6 py-2 bg-[#6C63FF] hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95";
            iconContainer.className = "p-2 rounded-lg bg-[#6C63FF]/10 text-[#6C63FF]";
            iconContainer.innerHTML = '<i data-lucide="help-circle" class="w-5 h-5"></i>';
        }

        if (window.lucide) window.lucide.createIcons({ scope: iconContainer });

        modal.classList.remove('hidden');
        setTimeout(() => container.classList.remove('scale-95'), 10);
        input.focus();

        const close = (val) => {
            container.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 200);
            resolve(val);
        };

        confirmBtn.onclick = () => close(options.noInput ? true : input.value);
        cancelBtn.onclick = () => close(null);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        };
    });
};

window.customConfirm = (title, message, isDelete = false) => {
    return window.customPrompt(title, message, '', { noInput: true, isDelete });
};

// --- DOM READY ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSidebarListeners();
    initNotificationListeners();
    initMobileSidebarClose();
    
    // Global Listeners
    document.getElementById('task-form')?.addEventListener('submit', window.handleSubmit);
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        window.renderBoard(allTasks);
    });

    // Delegar cliques para botões de ação em massa (opcional, já estão nos onclicks)
});
