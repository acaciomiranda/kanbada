/**
 * Card.js
 * Componente responsável pela criação do HTML de um cartão de tarefa.
 * Versão Corrigida com Botão de Editar e Melhorias de Segurança
 */

window.createTaskCard = function(task, deletingId = null, toggleDelete = () => {}, confirmDelete = () => {}) {
    // Proteção contra XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Padronização e Proteção
    const id = task.__backendId || 'temp-' + Math.random();
    const title = escapeHtml(task.title || 'Sem título');
    const dueDate = task.due_date || null;
    const assignee = escapeHtml(task.assignee || 'Sem responsável');
    const project = escapeHtml(task.project || 'Geral');
    const tag = escapeHtml(task.tag || 'Tarefa');
    const description = escapeHtml(task.description || '');
    const filename = escapeHtml(task.filename || '');
    const reactions = task.reactions || { thumbsUp: 0, heart: 0 };
    const isLocal = id.toString().startsWith('temp-') || id.toString().startsWith('task-');
    
    const isDeleting = deletingId === id;
    const card = document.createElement('div');
    
    // Design Dark Mode
    const baseClasses = "group relative p-4 rounded-[18px] shadow-sm hover:shadow-xl transition-all duration-300 border cursor-grab active:cursor-grabbing";
    const isSelected = (window.selectedTaskIds || []).includes(id);
    const borderClasses = isSelected ? "border-[#FF6B8A]" : (isLocal ? "border-[#FF6B8A]/40 border-dashed" : "border-transparent hover:border-[#FF6B8A]/30");
    const selectionBg = isSelected ? "bg-[#FF6B8A]/5" : "bg-[#1e1e36]";
    
    card.className = `${baseClasses} ${selectionBg} text-[#e0e0ec] ${borderClasses}`;
    card.dataset.id = id;
    card.style.animation = "fadeIn 0.4s ease-out";
    card.onclick = function(e) {
        if (!e.target.closest('button') && !e.target.closest('select') && !task.deleted) {
            window.editTask(id);
        }
    };

    // Mapeamento de cores de tag
    const colorMap = {
        '#FF6B8A': { bg: 'rgba(255, 107, 138, 0.15)', cardBg: 'rgba(255, 107, 138, 0.03)', text: '#FF6B8A' },
        '#6C63FF': { bg: 'rgba(108, 99, 255, 0.15)', cardBg: 'rgba(108, 99, 255, 0.03)', text: '#6C63FF' },
        '#00C9A7': { bg: 'rgba(0, 201, 167, 0.15)', cardBg: 'rgba(0, 201, 167, 0.03)', text: '#00C9A7' },
        '#FFB84D': { bg: 'rgba(255, 184, 77, 0.15)', cardBg: 'rgba(255, 184, 77, 0.03)', text: '#FFB84D' },
        '#4DA8FF': { bg: 'rgba(77, 168, 255, 0.15)', cardBg: 'rgba(77, 168, 255, 0.03)', text: '#4DA8FF' },
        '#FF5733': { bg: 'rgba(255, 87, 51, 0.15)', cardBg: 'rgba(255, 87, 51, 0.03)', text: '#FF5733' },
        '#C70039': { bg: 'rgba(199, 0, 57, 0.15)', cardBg: 'rgba(199, 0, 57, 0.03)', text: '#C70039' }
    };
    const tagStyles = colorMap[task.tag_color] || colorMap['#FF6B8A'];
    
    // Aplica o destaque elegante no card inteiro
    card.style.background = `linear-gradient(145deg, #1e1e36, ${tagStyles.cardBg})`;
    card.style.borderLeft = `3px solid ${tagStyles.text}`;
    
    // Formatar data de vencimento
    let dueDateDisplay = '';
    let dueDateClass = '';
    if (dueDate) {
        const due = new Date(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            dueDateClass = 'text-red-400';
            dueDateDisplay = 'Atrasada';
        } else if (diffDays === 0) {
            dueDateClass = 'text-orange-400';
            dueDateDisplay = 'Hoje';
        } else if (diffDays === 1) {
            dueDateClass = 'text-yellow-400';
            dueDateDisplay = 'Amanhã';
        } else {
            dueDateClass = 'text-gray-400';
            dueDateDisplay = new Date(dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        }
    }

    card.innerHTML = `
        <div class="flex flex-col gap-3">
            <!-- Cabeçalho com Tag e Projeto -->
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <input type="checkbox" 
                        ${(window.selectedTaskIds || []).includes(id) ? 'checked' : ''}
                        onchange="window.toggleTaskSelection('${id}', event)"
                        onclick="event.stopPropagation()"
                        class="w-4 h-4 rounded border-[#2a2a44] bg-[#12121f] text-[#FF6B8A] focus:ring-[#FF6B8A] cursor-pointer transition-all">
                        
                    ${task.tag ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex-shrink-0" style="background:${tagStyles.bg}; color:${tagStyles.text}">${tag}</span>` : ''}
                    ${project && project !== 'Geral' ? `<span class="text-[9px] text-[#9090b0] bg-white/5 px-2 py-1 rounded-md font-medium tracking-wide truncate"># ${project}</span>` : ''}
                </div>
                
                <!-- Botões de Ação -->
                <div class="flex items-center gap-1 flex-shrink-0">
                    ${isLocal ? `<span class="text-[9px] font-bold text-[#FF6B8A]/60 px-1.5 py-0.5 rounded border border-[#FF6B8A]/20">LOCAL</span>` : ''}
                    
                    ${task.deleted ? `
                        <button onclick="window.restoreTask('${id}')" 
                            class="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-green-400 transition-all duration-200"
                            title="Restaurar tarefa">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : task.archived ? `
                        <button onclick="window.restoreTask('${id}')" 
                            class="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-green-400 transition-all duration-200"
                            title="Desarquivar tarefa">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : `
                        <button onclick="window.archiveTask('${id}')" 
                            class="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-green-400 transition-all duration-200"
                            title="Arquivar tarefa">
                            <i data-lucide="archive" class="w-3.5 h-3.5"></i>
                        </button>
                        
                        <button onclick="window.editTask('${id}')" 
                            class="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-blue-400 transition-all duration-200"
                            title="Editar tarefa">
                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                        </button>
                    `}
                    
                    <button onclick="window.toggleDelete('${id}')" 
                        class="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-[#FF6B8A] transition-all duration-200"
                        title="${task.deleted ? 'Excluir definitivamente' : 'Mover para lixeira'}">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
            
            <!-- Título -->
            <h3 class="font-semibold text-[14px] leading-tight group-hover:text-[#FF6B8A] transition-colors line-clamp-2">${title}</h3>
            
            ${description ? `
                <p class="text-xs text-gray-400 line-clamp-4 mt-1 leading-relaxed">${description}</p>
            ` : ''}
            
            <!-- Select Status / Reações -->
            <div class="flex items-center justify-between mt-1 gap-2">
                <div class="flex-1">
                    <select onchange="window.changeTaskStatus('${id}', this.value, event)" 
                        class="w-full bg-[#12121f] border border-[#2a2a44] text-[#9090b0] text-[10px] rounded px-2 py-1 outline-none hover:border-[#FF6B8A] focus:border-[#FF6B8A] transition-colors cursor-pointer" 
                        onclick="event.stopPropagation()">
                        ${(window.allColumns || []).map(col => `<option value="${col.id}" ${col.id === task.status ? 'selected' : ''}>${col.title}</option>`).join('')}
                    </select>
                </div>
                
                <div class="flex items-center gap-1.5">
                    <button onclick="window.reactToTask('${id}', 'thumbsUp', event)" class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 text-[10px] text-gray-400 hover:text-yellow-400 transition-colors">
                        👍 <span class="font-medium">${reactions.thumbsUp || 0}</span>
                    </button>
                    <button onclick="window.reactToTask('${id}', 'heart', event)" class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 text-[10px] text-gray-400 hover:text-red-400 transition-colors">
                        ❤️ <span class="font-medium">${reactions.heart || 0}</span>
                    </button>
                </div>
            </div>
            
            <!-- Footer: Data, Anexo e Avatar -->
            <div class="flex items-center justify-between mt-1 border-t border-[#2a2a44]/50 pt-2">
                <div class="flex items-center gap-3">
                    ${dueDate ? `
                        <div class="flex items-center gap-1 text-[11px] ${dueDateClass}" title="Data de vencimento">
                            <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                            <span>${dueDateDisplay}</span>
                        </div>
                    ` : ''}
                    ${filename ? `
                        <button onclick="window.downloadAttachment('${id}')" 
                            class="flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#4DA8FF] transition-colors truncate max-w-[100px]" 
                            title="Baixar: ${filename}">
                            <i data-lucide="download" class="w-3.5 h-3.5 flex-shrink-0"></i>
                            <span class="truncate">${filename}</span>
                        </button>
                    ` : task.has_attachment ? `
                        <div class="flex items-center gap-1 text-[11px] text-gray-400" title="Com anexo">
                            <i data-lucide="paperclip" class="w-3.5 h-3.5"></i>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Avatar do Responsável -->
                <div class="flex items-center">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold border-2 border-[#1e1e36] shadow-sm ring-1 ring-white/5" 
                         title="${assignee}">
                        ${assignee.charAt(0).toUpperCase()}
                    </div>
                </div>
            </div>
        </div>

        <!-- Overlay de Exclusão -->
        <div class="delete-overlay absolute inset-0 bg-[#1e1e36]/95 backdrop-blur-sm flex flex-col items-center justify-center rounded-[18px] transition-all duration-300 ${isDeleting ? 'opacity-100 visible z-10' : 'opacity-0 invisible pointer-events-none'}">
            <div class="text-center px-4">
                <i data-lucide="alert-triangle" class="w-10 h-10 text-[#FF6B8A] mx-auto mb-2"></i>
                <p class="text-[13px] font-bold text-[#e0e0ec] mb-1">${task.deleted ? 'Excluir definitivamente?' : 'Mover para Lixeira?'}</p>
                <p class="text-[10px] text-gray-400 mb-4">${task.deleted ? 'Esta ação não pode ser desfeita' : 'Ficará na lixeira por 7 dias'}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="window.confirmDelete('${id}')" 
                    class="px-4 py-2 bg-[#FF6B8A] text-white text-[11px] font-bold rounded-lg hover:bg-pink-600 shadow-sm transition-colors active:scale-95">
                    Sim, Excluir
                </button>
                <button onclick="window.toggleDelete('${id}')" 
                    class="px-4 py-2 bg-white/5 text-[#9090b0] text-[11px] font-bold rounded-lg hover:bg-white/10 transition-colors active:scale-95">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    // Processa ícones Lucide dentro do card
    if (window.lucide) {
        setTimeout(() => window.lucide.createIcons({ scope: card }), 0);
    }

    return card;
};
