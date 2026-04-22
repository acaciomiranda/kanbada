/**
 * Card.js
 * Componente responsável pela criação do HTML de um cartão de tarefa.
 */

window.createTaskCard = function(task) {
    const id = task.__backendId;
    const title = task.title || 'Sem título';
    const dueDate = task.due_date || null;
    const assignee = task.assignee || 'Usuário';
    const project = task.project || 'Geral';
    const tag = task.tag || '';
    const reactions = task.reactions || { thumbsUp: 0, heart: 0 };
    
    const card = document.createElement('div');
    const isSelected = (window.selectedTaskIds || []).includes(id);
    
    const colorMap = {
        '#FF6B8A': { bg: 'rgba(255, 107, 138, 0.15)', cardBg: 'rgba(255, 107, 138, 0.03)', text: '#FF6B8A' },
        '#6C63FF': { bg: 'rgba(108, 99, 255, 0.15)', cardBg: 'rgba(108, 99, 255, 0.03)', text: '#6C63FF' },
        '#00C9A7': { bg: 'rgba(0, 201, 167, 0.15)', cardBg: 'rgba(0, 201, 167, 0.03)', text: '#00C9A7' },
        '#FFB84D': { bg: 'rgba(255, 184, 77, 0.15)', cardBg: 'rgba(255, 184, 77, 0.03)', text: '#FFB84D' },
        '#4DA8FF': { bg: 'rgba(77, 168, 255, 0.15)', cardBg: 'rgba(77, 168, 255, 0.03)', text: '#4DA8FF' }
    };
    const tagStyles = colorMap[task.tag_color] || colorMap['#FF6B8A'];

    card.className = `group relative p-4 rounded-[18px] shadow-sm hover:shadow-xl transition-all duration-300 border cursor-grab active:cursor-grabbing ${isSelected ? 'border-[#FF6B8A] bg-[#FF6B8A]/5' : 'border-transparent bg-[#1e1e36] text-[#e0e0ec] hover:border-[#FF6B8A]/30'}`;
    card.dataset.id = id;
    card.style.background = `linear-gradient(145deg, #1e1e36, ${tagStyles.cardBg})`;
    card.style.borderLeft = `3px solid ${tagStyles.text}`;
    
    card.onclick = (e) => {
        if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
            window.editTask(id);
        }
    };

    card.innerHTML = `
        <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.toggleTaskSelection('${id}', event)" onclick="event.stopPropagation()"
                        class="w-4 h-4 rounded border-[#2a2a44] bg-[#12121f] text-[#FF6B8A] focus:ring-[#FF6B8A] cursor-pointer">
                    ${tag ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style="background:${tagStyles.bg}; color:${tagStyles.text}">${tag}</span>` : ''}
                    <span class="text-[9px] text-[#9090b0] bg-white/5 px-2 py-0.5 rounded truncate"># ${project}</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.editTask('${id}')" class="p-1 text-gray-500 hover:text-white"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
                    <button onclick="window.toggleDelete('${id}')" class="p-1 text-gray-500 hover:text-[#FF6B8A]"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                </div>
            </div>
            
            <h4 class="text-sm font-bold leading-tight group-hover:text-[#FF6B8A] transition-colors">${title}</h4>
            
            ${task.subtasks && task.subtasks.length > 0 ? (() => {
                const done = task.subtasks.filter(s => s.completed).length;
                const total = task.subtasks.length;
                const pct = Math.round((done / total) * 100);
                return `
                    <div class="mt-1">
                        <div class="flex justify-between text-[9px] text-gray-500 mb-1">
                            <span>${done}/${total} subtarefas</span>
                            <span>${pct}%</span>
                        </div>
                        <div class="w-full h-1 bg-[#12121f] rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-[#FF6B8A] to-[#6C63FF]" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            })() : ''}

            <div class="flex items-center justify-between mt-1 pt-2 border-t border-[#2a2a44]/50">
                <div class="flex items-center gap-2">
                    ${dueDate ? `<div class="flex items-center gap-1 text-[10px] text-gray-500"><i data-lucide="calendar" class="w-3 h-3"></i> ${new Date(dueDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</div>` : ''}
                    ${task.fileData ? `<i data-lucide="paperclip" class="w-3 h-3 text-gray-500"></i>` : ''}
                </div>
                <div class="w-5 h-5 rounded-full bg-[#6C63FF] flex items-center justify-center text-[8px] font-bold text-white border border-[#1e1e36]" title="${assignee}">
                    ${assignee.charAt(0).toUpperCase()}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) {
        setTimeout(() => window.lucide.createIcons({ scope: card }), 0);
    }
    return card;
};
