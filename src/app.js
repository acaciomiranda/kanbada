/**
 * app.js
 * Lógica principal do Kanbada: Login, Filtros, Notificações, Board e Importação Robusta.
 * Versão Firebase: Sincronização em nuvem e Autenticação Segura.
 */

import { authService } from './services/auth.service.js';
import { dbService } from './services/db.service.js';

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
let sortableInstances = [];

// --- FILTROS ---
function getVisibleTasks(data = allTasks) {
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
        } else {
            currentUser.name = currentUser.displayName || 'Usuário';
            currentUser.initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        }
    } catch (e) {
        console.error('Erro ao carregar config do Firestore:', e);
    }
}

// --- UTILITÁRIOS ---
window.showToast = function(msg, type = 'success') {
    const toast = document.createElement('div');
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
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- AUTH (FIREBASE OBSERVER) ---
function checkAuth() {
    authService.onAuthChange(async (user) => {
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
    
    await loadConfig();
    updateAvatars();
    renderProjectsSidebar();
    updateProjectSelects();
    await loadTasks();
    loadNotifications();
}

function hideApp() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-root').classList.remove('hidden');
    if (window.renderLogin) window.renderLogin();
}

window.logout = async function() {
    const confirmed = await window.customConfirm('Confirmar Saída', 'Deseja realmente sair? Suas tarefas estão sincronizadas.', false);
    if (!confirmed) return;
    await authService.logout();
};

function updateAvatars() {
    if (!currentUser) return;
    document.querySelectorAll('.avatar-user').forEach(av => {
        av.textContent = currentUser.initials;
    });
    const nd = document.getElementById('user-display-name');
    if (nd) nd.textContent = currentUser.name;
    const em = document.getElementById('user-email');
    if (em) em.textContent = currentUser.email;
}

// --- BOARD RENDERING ---
window.renderBoard = function(data = allTasks) {
    const container = document.getElementById('kanban-board-container');
    if (!container) return;

    if (viewMode === 'list') {
        renderListView(getVisibleTasks(data));
        return;
    }

    container.innerHTML = '';
    const visibleTasks = getVisibleTasks(data);

    allColumns.forEach(col => {
        const colEl = document.createElement('div');
        colEl.className = 'kanban-column w-80 flex-shrink-0 flex flex-col h-full group/col';
        colEl.innerHTML = `
            <div class="flex items-center justify-between mb-4 px-1">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full" style="background: ${col.color}"></div>
                    <h3 class="font-bold text-sm tracking-wide text-[#9090b0] uppercase">${col.title}</h3>
                    <span id="count-${col.id}" class="bg-[#1e1e36] text-[10px] font-bold text-gray-500 px-2 py-0.5 rounded-full border border-[#2a2a44]">0</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity">
                    <button onclick="window.openModal('${col.id}')" class="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-[#FF6B8A]">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </button>
                    <button onclick="window.promptEditColumn('${col.id}')" class="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white">
                        <i data-lucide="more-horizontal" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <div id="col-${col.id}" class="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1 pb-10 min-h-[100px]"></div>
        `;
        container.appendChild(colEl);
        
        const tasks = visibleTasks.filter(t => t.status === col.id);
        const colContent = document.getElementById(`col-${col.id}`);
        const counter = document.getElementById(`count-${col.id}`);
        if (counter) counter.textContent = tasks.length;
        
        tasks.forEach(t => colContent.appendChild(window.createTaskCard(t)));
    });

    if (window.lucide) window.lucide.createIcons({ scope: container });
    initSortable();
    updateBulkActionsUI();
};

function updateBulkActionsUI() {
    const bulkBar = document.getElementById('bulk-actions');
    const bulkCount = document.getElementById('bulk-count');
    if (!bulkBar) return;

    if (selectedTaskIds.length > 0) {
        bulkBar.classList.remove('hidden');
        bulkBar.classList.add('flex');
        bulkCount.textContent = `${selectedTaskIds.length} selecionado(s)`;
        
        const statusSelect = document.getElementById('bulk-status-select');
        if (statusSelect) {
            const options = `<option value="">Mover para...</option>` + 
                allColumns.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
            statusSelect.innerHTML = options;
        }
    } else {
        bulkBar.classList.add('hidden');
        bulkBar.classList.remove('flex');
    }
}

// --- MODAL LOGIC ---
window.openModal = function(statusOrId = 'plan') {
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    editingTaskId = null;
    currentEditingSubtasks = [];
    
    if (allTasks.find(t => t.__backendId.toString() === statusOrId.toString())) {
        // Modo Edição
        const task = allTasks.find(t => t.__backendId.toString() === statusOrId.toString());
        editingTaskId = task.__backendId;
        document.getElementById('modal-title').textContent = 'Editar Tarefa';
        document.getElementById('f-title').value = task.title;
        document.getElementById('f-date').value = task.due_date || '';
        document.getElementById('f-assignee').value = task.assignee || '';
        document.getElementById('f-project').value = task.project || 'Geral';
        document.getElementById('f-tag').value = task.tag || '';
        document.getElementById('f-tagcolor').value = task.tag_color || '#FF6B8A';
        document.getElementById('f-description').value = task.description || '';
        document.getElementById('f-status').value = task.status;
        currentEditingSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
    } else {
        // Modo Nova Tarefa
        form.reset();
        document.getElementById('modal-title').textContent = 'Nova Tarefa';
        const colId = (statusOrId && allColumns.some(c => c.id === statusOrId)) ? statusOrId : (allColumns[0] ? allColumns[0].id : 'plan');
        document.getElementById('f-status').value = colId;
        document.getElementById('f-project').value = currentProjectFilter || 'Geral';
        const fileInput = document.getElementById('f-file');
        if (fileInput) fileInput.value = '';
    }

    renderSubtasks();
    modal.classList.remove('hidden');
    document.getElementById('f-title').focus();
    if (window.lucide) window.lucide.createIcons({ scope: modal });
};

window.closeModal = function() {
    document.getElementById('task-modal').classList.add('hidden');
    editingTaskId = null;
};

// --- SUBTASKS ---
function renderSubtasks() {
    const container = document.getElementById('subtasks-container');
    const count = document.getElementById('subtask-count');
    if (!container) return;

    if (currentEditingSubtasks.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-gray-600 italic text-xs border-2 border-dashed border-[#2a2a44] rounded-2xl">Nenhuma subtarefa adicionada</div>`;
        if (count) count.textContent = '0 itens';
        return;
    }

    container.innerHTML = currentEditingSubtasks.map((s, i) => `
        <div class="flex items-center gap-3 bg-[#12121f] p-3 rounded-xl border border-[#2a2a44] group">
            <input type="checkbox" ${s.completed ? 'checked' : ''} onchange="window.toggleSubtaskInModal(${i})"
                class="w-4 h-4 rounded border-[#2a2a44] bg-[#1e1e36] text-[#FF6B8A] focus:ring-[#FF6B8A] cursor-pointer">
            <input type="text" value="${s.text}" onchange="window.updateSubtaskText(${i}, this.value)"
                class="flex-1 bg-transparent border-none outline-none text-xs ${s.completed ? 'line-through text-gray-500' : 'text-white'}">
            <button type="button" onclick="window.removeSubtask(${i})" class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        </div>
    `).join('');
    
    if (count) count.textContent = `${currentEditingSubtasks.length} item(ns)`;
    if (window.lucide) window.lucide.createIcons({ scope: container });
}

window.addSubtask = function() {
    const input = document.getElementById('new-subtask-text');
    const text = input.value.trim();
    if (text) {
        currentEditingSubtasks.push({ id: Date.now(), text, completed: false });
        input.value = '';
        renderSubtasks();
        input.focus();
    }
};

window.toggleSubtaskInModal = function(index) {
    currentEditingSubtasks[index].completed = !currentEditingSubtasks[index].completed;
    renderSubtasks();
};

window.updateSubtaskText = function(index, text) {
    currentEditingSubtasks[index].text = text;
};

window.removeSubtask = function(index) {
    currentEditingSubtasks.splice(index, 1);
    renderSubtasks();
};

// --- HANDLE SUBMIT ---
window.handleSubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById('f-title').value.trim();
    if (!title) {
        window.showToast('Título é obrigatório!', 'error');
        return;
    }

    const fileInput = document.getElementById('f-file');
    let fileData = null;
    let filename = null;

    if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        filename = file.name;
        
        if (file.size > 1024 * 1024) {
            window.showToast('Arquivo muito grande! Máximo 1MB no plano gratuito.', 'error');
            return;
        }

        fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }

    const taskData = {
        title: title,
        due_date: document.getElementById('f-date').value || null,
        assignee: document.getElementById('f-assignee').value.trim() || currentUser?.name || 'Usuário',
        project: document.getElementById('f-project').value || 'Geral',
        tag: document.getElementById('f-tag').value.trim() || '',
        tag_color: document.getElementById('f-tagcolor').value,
        description: document.getElementById('f-description').value,
        status: document.getElementById('f-status').value,
        subtasks: [...currentEditingSubtasks],
        updatedAt: new Date().toISOString()
    };

    if (fileData) {
        taskData.fileData = fileData;
        taskData.filename = filename;
    }

    let targetTask = null;

    if (editingTaskId) {
        const index = allTasks.findIndex(t => t.__backendId.toString() === editingTaskId.toString());
        if (index > -1) {
            const oldTask = allTasks[index];
            taskData.fileData = fileData || oldTask.fileData;
            taskData.filename = filename || oldTask.filename;
            
            allTasks[index] = { ...allTasks[index], ...taskData };
            targetTask = allTasks[index];
            window.showToast('Tarefa atualizada!');
        }
    } else {
        const newTask = {
            ...taskData,
            __backendId: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            archived: false,
            deleted: false,
            reactions: { thumbsUp: 0, heart: 0 }
        };
        allTasks.push(newTask);
        targetTask = newTask;
        window.showToast('Tarefa criada!');
    }

    if (targetTask) await saveTasks(targetTask);
    window.closeModal();
    window.renderBoard(allTasks);
};

// --- ACTIONS EM MASSA ---
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

window.bulkMoveToColumn = async function(columnId) {
    if (window.selectedTaskIds.length === 0) return;
    const col = allColumns.find(c => c.id === columnId);
    if (!col) return;

    const idsToMove = [...window.selectedTaskIds];
    let moved = 0;
    const tasksToSave = [];

    idsToMove.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task && !task.deleted && !task.archived) {
            task.status = columnId;
            tasksToSave.push(task);
            moved++;
        }
    });

    if (moved === 0) return;

    window.selectedTaskIds = [];
    await dbService.batchSaveTasks(currentUser.uid, tasksToSave);
    window.renderBoard(allTasks);
    window.showToast(`${moved} tarefa(s) movida(s) para "${col.title}"!`);
};

window.bulkArchive = async function() {
    if (window.selectedTaskIds.length === 0) return;

    const idsToArchive = [...window.selectedTaskIds];
    let archived = 0;
    const tasksToSave = [];

    idsToArchive.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task && !task.deleted && !task.archived) {
            task.archived = true;
            tasksToSave.push(task);
            archived++;
        }
    });

    window.selectedTaskIds = [];
    if (tasksToSave.length > 0) {
        await dbService.batchSaveTasks(currentUser.uid, tasksToSave);
    }
    window.renderBoard(allTasks);
    window.showToast(`${archived} tarefa(s) arquivada(s)!`);
};

window.bulkDelete = async function() {
    if (window.selectedTaskIds.length === 0) return;
    
    const confirmed = await window.customConfirm('Excluir Selecionados', `Deseja realmente excluir as ${window.selectedTaskIds.length} tarefas selecionadas?`, true);
    if (!confirmed) return;

    const idsToDelete = [...window.selectedTaskIds];
    const toRecycle = [];
    const toDeletePermanently = [];

    idsToDelete.forEach(id => {
        const task = allTasks.find(t => t.__backendId.toString() === id.toString());
        if (task) {
            if (task.deleted) {
                toDeletePermanently.push(task);
            } else {
                task.deleted = true;
                task.archived = false;
                task.deletedAt = new Date().toISOString();
                toRecycle.push(task);
            }
        }
    });

    window.selectedTaskIds = [];

    for (const t of toDeletePermanently) {
        await dbService.deleteTask(currentUser.uid, t.__backendId);
        const idx = allTasks.indexOf(t);
        if (idx > -1) allTasks.splice(idx, 1);
    }

    if (toRecycle.length > 0) {
        await dbService.batchSaveTasks(currentUser.uid, toRecycle);
    }

    window.renderBoard(allTasks);
    window.showToast(`${toRecycle.length + toDeletePermanently.length} tarefa(s) excluída(s)!`);
};

// --- DRAG AND DROP ---
function initSortable() {
    if (viewMode !== 'board') return; 
    sortableInstances.forEach(inst => inst.destroy());
    sortableInstances = [];
    
    allColumns.forEach(col => {
        const el = document.getElementById(`col-${col.id}`);
        if (el) {
            const inst = Sortable.create(el, {
                group: 'kanban',
                animation: 150,
                onEnd: async (evt) => {
                    const taskId = evt.item.dataset.id;
                    const newStatus = evt.to.id.replace('col-', '');
                    const task = allTasks.find(t => t.__backendId.toString() === taskId.toString());
                    
                    if (task) {
                        const oldStatus = task.status;
                        task.status = newStatus;
                        await saveTasks(task);
                        window.renderBoard(allTasks);
                    }
                }
            });
            sortableInstances.push(inst);
        }
    });
}

// --- DIALOGS ---
window.customConfirm = function(title, msg, isDanger = false) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const icon = document.getElementById('dialog-icon');
        const confirmBtn = document.getElementById('dialog-confirm');
        
        document.getElementById('dialog-title').textContent = title;
        document.getElementById('dialog-msg').textContent = msg;
        document.getElementById('dialog-input-container').classList.add('hidden');
        
        if (isDanger) {
            icon.className = "w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 mx-auto text-red-500";
            confirmBtn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-95";
        } else {
            icon.className = "w-16 h-16 rounded-2xl bg-[#FF6B8A]/10 flex items-center justify-center mb-6 mx-auto text-[#FF6B8A]";
            confirmBtn.className = "w-full bg-[#FF6B8A] hover:bg-pink-600 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-pink-500/20 active:scale-95";
        }
        
        dialog.classList.remove('hidden');
        
        confirmBtn.onclick = () => { dialog.classList.add('hidden'); resolve(true); };
        document.getElementById('dialog-cancel').onclick = () => { dialog.classList.add('hidden'); resolve(false); };
    });
};

window.customPrompt = function(title, msg, defaultValue = '') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const input = document.getElementById('dialog-input');
        
        document.getElementById('dialog-title').textContent = title;
        document.getElementById('dialog-msg').textContent = msg;
        document.getElementById('dialog-input-container').classList.remove('hidden');
        input.value = defaultValue;
        
        dialog.classList.remove('hidden');
        input.focus();
        
        document.getElementById('dialog-confirm').onclick = () => { dialog.classList.add('hidden'); resolve(input.value); };
        document.getElementById('dialog-cancel').onclick = () => { dialog.classList.add('hidden'); resolve(null); };
    });
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        window.renderBoard(allTasks);
    });
});

window.restoreTask = async function(id) {
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        task.deleted = false;
        task.archived = false;
        await saveTasks(task);
        window.renderBoard(allTasks);
        window.showToast('Tarefa restaurada!');
    }
};

window.archiveTask = async function(id) {
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        task.archived = true;
        await saveTasks(task);
        window.renderBoard(allTasks);
        window.showToast('Tarefa arquivada!');
    }
};

window.toggleDelete = async function(id) {
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        if (task.deleted) {
            const confirmed = await window.customConfirm('Excluir Permanente', 'Deseja excluir esta tarefa definitivamente?', true);
            if (confirmed) {
                await dbService.deleteTask(currentUser.uid, id);
                allTasks = allTasks.filter(t => t.__backendId !== id);
                window.renderBoard(allTasks);
                window.showToast('Tarefa excluída definitivamente!');
            }
        } else {
            task.deleted = true;
            task.archived = false;
            await saveTasks(task);
            window.renderBoard(allTasks);
            window.showToast('Movida para a lixeira');
        }
    }
};

window.downloadAttachment = function(id) {
    const task = allTasks.find(t => t.__backendId === id);
    if (!task || !task.fileData) return;
    
    const link = document.createElement('a');
    link.href = task.fileData;
    link.download = task.filename || 'anexo';
    link.click();
};

window.reactToTask = async function(id, type, event) {
    if(event) event.stopPropagation();
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task) {
        if (!task.reactions) task.reactions = { thumbsUp: 0, heart: 0 };
        task.reactions[type] = (task.reactions[type] || 0) + 1;
        await saveTasks(task);
        window.renderBoard(allTasks);
    }
};

window.changeTaskStatus = async function(id, newStatus, event) {
    if(event) event.stopPropagation();
    const task = allTasks.find(t => t.__backendId.toString() === id.toString());
    if (task && newStatus) {
        task.status = newStatus;
        await saveTasks(task);
        window.renderBoard(allTasks);
    }
};

window.setView = function(mode) {
    viewMode = mode;
    document.querySelectorAll('#sidebar a').forEach(a => a.classList.remove('bg-white/10', 'text-white'));
    const activeNav = document.getElementById('nav-' + mode);
    if (activeNav) activeNav.classList.add('bg-white/10', 'text-white');
    
    const title = { board: 'Quadro Kanban', list: 'Vista em Lista', archive: 'Tarefas Arquivadas', recycle: 'Lixeira' };
    const nd = document.getElementById('view-title');
    if (nd) nd.textContent = title[mode];
    
    window.renderBoard(allTasks);
};

window.editTask = function(id) {
    window.openModal(id);
};

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

window.filterByProject = function(name) {
    currentProjectFilter = (currentProjectFilter === name) ? null : name;
    renderProjectsSidebar();
    window.renderBoard(allTasks);
};

window.toggleMyTasks = function() {
    showOnlyMyTasks = !showOnlyMyTasks;
    const btn = document.getElementById('btn-filter-my');
    if (showOnlyMyTasks) {
        btn.classList.add('bg-[#FF6B8A]/20', 'text-[#FF6B8A]', 'border-[#FF6B8A]/30');
    } else {
        btn.classList.remove('bg-[#FF6B8A]/20', 'text-[#FF6B8A]', 'border-[#FF6B8A]/30');
    }
    window.renderBoard(allTasks);
};

function loadNotifications() {}
function initSidebarListeners() {}
function initNotificationListeners() {}
function initKeyboardShortcuts() {}
window.closeSidebar = () => {};
window.openSidebar = () => {};
window.toggleNotifications = () => {};
window.clearNotifications = () => {};
window.exportTasks = () => {};
window.handleFileImport = () => {};
window.openReports = () => {};
window.promptEditColumn = () => {};
window.promptNewProject = () => {};
window.promptNewColumn = () => {};
window.promptEditProject = () => {};
function base64ToBlob(base64) {
    const byteString = atob(base64.split(',')[1]);
    const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeString });
}
