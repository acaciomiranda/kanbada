/**
 * Column.js
 * Componente responsável pela renderização das colunas do Kanban.
 */

window.renderColumn = function(status, tasks, deletingId = null, toggleDelete = () => {}, confirmDelete = () => {}) {
    const col = document.getElementById('col-' + status);
    if (!col) return;

    const counter = document.getElementById('count-' + status);
    if (counter) counter.textContent = tasks.length;

    col.innerHTML = '';
    tasks.forEach((task) => {
        if (window.createTaskCard) {
            const card = window.createTaskCard(task, deletingId, toggleDelete, confirmDelete);
            col.appendChild(card);
        }
    });
};
