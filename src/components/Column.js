/**
 * Column.js
 * Componente responsável pela renderização das colunas do Kanban.
 */

window.renderColumn = function(status, tasks, deletingId = null, toggleDelete = () => {}, confirmDelete = () => {}) {
    const col = document.getElementById('col-' + status);
    if (!col) return;

    // Atualiza o contador da coluna
    const counter = document.getElementById('count-' + status);
    if (counter) counter.textContent = tasks.length;

    // Limpa a coluna atual
    col.innerHTML = '';

    // Injeta os cards correspondentes
    tasks.forEach((task) => {
        // Usa a função global window.createTaskCard
        if (window.createTaskCard) {
            const card = window.createTaskCard(task, deletingId, toggleDelete, confirmDelete);
            col.appendChild(card);
        }
    });
};
