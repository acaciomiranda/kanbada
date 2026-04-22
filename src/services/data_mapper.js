/**
 * data_mapper.js
 * Serviço robusto de mapeamento de dados Asana.
 * Suporta colunas em Português e Inglês com detecção automática de cabeçalho.
 */

window.dataMapper = {
    /**
     * Mapeadores de nomes de colunas conhecidos (Case-Insensitive)
     */
    columnMaps: {
        title: ['Name', 'Nome', 'Tarefa', 'Task Name'],
        status: ['Section/Column', 'Seção/Coluna', 'Status', 'Coluna'],
        assignee: ['Assignee', 'Responsável', 'Atribuído a'],
        due_date: ['Due Date', 'Data de conclusão', 'Data de entrega', 'Vencimento', 'Prazo'],
        project: ['Project', 'Projeto']
    },

    /**
     * Tenta encontrar o valor de uma coluna baseada em múltiplos nomes possíveis.
     */
    getValue(row, possibleKeys) {
        // Encontra a chave real no objeto que bate com uma das possíveis (ignore case)
        const rowKeys = Object.keys(row);
        for (const key of rowKeys) {
            const normalizedKey = key.trim().toLowerCase();
            if (possibleKeys.some(p => p.toLowerCase() === normalizedKey)) {
                return row[key];
            }
        }
        return null;
    },

    transformAsanaData(rawData) {
        if (!Array.isArray(rawData) || rawData.length === 0) {
            console.error("DataMapper: Nenhum dado bruto recebido.");
            return [];
        }

        console.log("DataMapper: Analisando primeira linha do Excel:", rawData[0]);

        return rawData.map((row, index) => {
            const rawStatus = this.getValue(row, this.columnMaps.status) || '';
            const section = rawStatus.toString().toLowerCase();
            
            let status = 'plan';
            if (section.includes('andamento') || section.includes('doing') || section.includes('progress')) {
                status = 'progress';
            } else if (section.includes('concluído') || section.includes('done') || section.includes('finalizado')) {
                status = 'done';
            }

            return {
                __backendId: 'import-' + Date.now() + '-' + index,
                title: this.getValue(row, this.columnMaps.title) || 'Sem título',
                status: status,
                assignee: this.getValue(row, this.columnMaps.assignee) || 'Sem responsável',
                due_date: this.getValue(row, this.columnMaps.due_date) || '',
                project: this.getValue(row, this.columnMaps.project) || 'Importado',
                tag: section || 'Asana',
                tag_color: status === 'done' ? '#00C9A7' : (status === 'progress' ? '#6C63FF' : '#FF6B8A'),
                created_at: new Date().toISOString()
            };
        }).filter(t => t.title && t.title !== 'Sem título'); // Remove linhas vazias
    }
};
