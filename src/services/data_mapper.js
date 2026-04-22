/**
 * data_mapper.js
 * Mapeamento de dados Asana.
 * Melhorias: suporte a tags Section/Column do Asana, colunas dinâmicas, description, priority.
 */

window.dataMapper = {
    columnMaps: {
        title:       ['Name', 'Nome', 'Tarefa', 'Task Name', 'Task'],
        status:      ['Section/Column', 'Seção/Coluna', 'Status', 'Coluna', 'Column', 'Section'],
        assignee:    ['Assignee', 'Responsável', 'Atribuído a', 'Assigned To'],
        due_date:    ['Due Date', 'Data de conclusão', 'Data de entrega', 'Vencimento', 'Prazo', 'Deadline'],
        project:     ['Project', 'Projeto', 'Projects'],
        description: ['Notes', 'Description', 'Descrição', 'Notas', 'Details'],
        priority:    ['Priority', 'Prioridade']
    },

    getValue(row, possibleKeys) {
        const rowKeys = Object.keys(row);
        for (const key of rowKeys) {
            const normalizedKey = key.toString().trim().toLowerCase();
            if (possibleKeys.some(p => p.toLowerCase() === normalizedKey)) {
                const val = row[key];
                return (val !== null && val !== undefined) ? val.toString().trim() : null;
            }
        }
        return null;
    },

    // Mapeamento de status para id de coluna do Kanbada
    mapStatus(rawStatus) {
        if (!rawStatus) return 'plan';
        const s = rawStatus.toLowerCase();
        if (s.includes('andamento') || s.includes('doing') || s.includes('in progress') || s.includes('progress') || s.includes('wip')) return 'progress';
        if (s.includes('concluído') || s.includes('concluido') || s.includes('done') || s.includes('finalizado') || s.includes('completed') || s.includes('complete')) return 'done';
        return 'plan';
    },

    // Mapeamento de prioridade para cor de tag
    mapPriorityColor(priority, status) {
        if (priority) {
            const p = priority.toLowerCase();
            if (p.includes('alta') || p.includes('high') || p.includes('urgente') || p.includes('critical')) return '#FF6B8A';
            if (p.includes('média') || p.includes('media') || p.includes('medium') || p.includes('normal')) return '#FFB84D';
            if (p.includes('baixa') || p.includes('low')) return '#4DA8FF';
        }
        // Fallback por status
        if (status === 'done') return '#00C9A7';
        if (status === 'progress') return '#6C63FF';
        return '#FF6B8A';
    },

    transformAsanaData(rawData) {
        if (!Array.isArray(rawData) || rawData.length === 0) {
            console.warn('DataMapper: Nenhum dado recebido.');
            return [];
        }

        const tasks = rawData.map((row, index) => {
            const rawTitle = this.getValue(row, this.columnMaps.title);
            if (!rawTitle || rawTitle === '') return null; // Linha vazia

            const rawStatus = this.getValue(row, this.columnMaps.status) || '';
            const priority = this.getValue(row, this.columnMaps.priority) || '';
            const status = this.mapStatus(rawStatus);

            // Normalização de data
            let due_date = this.getValue(row, this.columnMaps.due_date) || '';
            if (due_date) {
                // Tenta converter para YYYY-MM-DD
                try {
                    const d = new Date(due_date);
                    if (!isNaN(d.getTime())) {
                        due_date = d.toISOString().split('T')[0];
                    }
                } catch { /* mantém original */ }
            }

            return {
                __backendId: `import-${Date.now()}-${index}`,
                title: rawTitle,
                status,
                assignee: this.getValue(row, this.columnMaps.assignee) || 'Sem responsável',
                due_date,
                project: this.getValue(row, this.columnMaps.project) || 'Importado',
                description: this.getValue(row, this.columnMaps.description) || '',
                tag: rawStatus || (priority ? `Prio: ${priority}` : 'Asana'),
                tag_color: this.mapPriorityColor(priority, status),
                reactions: { thumbsUp: 0, heart: 0 },
                created_at: new Date().toISOString()
            };
        }).filter(Boolean); // Remove nulls

        console.log(`DataMapper: ${tasks.length} tarefas mapeadas de ${rawData.length} linhas.`);
        return tasks;
    }
};
