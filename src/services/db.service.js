/**
 * db.service.js
 * Serviço de banco de dados usando Firebase Compat (Global).
 */

window.dbService = {
    // Salva/atualiza perfil do usuário
    async saveProfile(uid, data) {
        return window.db.doc(`users/${uid}/config/profile`).set(data, { merge: true });
    },

    // Salva configurações (projetos e colunas)
    async saveConfig(uid, projects, columns) {
        return window.db.doc(`users/${uid}/config/board`).set({ projects, columns });
    },

    // Carrega configurações
    async loadConfig(uid) {
        const snap = await window.db.collection(`users/${uid}/config`).get();
        const result = {};
        snap.forEach(d => { result[d.id] = d.data(); });
        return result;
    },

    // Salva uma tarefa individual (cria ou atualiza)
    async saveTask(uid, task) {
        const id = task.__backendId || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2));
        const ref = window.db.doc(`users/${uid}/tasks/${id}`);
        await ref.set({ ...task, __backendId: id, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return id;
    },

    // Deleta uma tarefa do Firestore (exclusão permanente)
    async deleteTask(uid, taskId) {
        return window.db.doc(`users/${uid}/tasks/${taskId}`).delete();
    },

    // Carrega todas as tarefas de uma vez (para o carregamento inicial)
    async loadAllTasks(uid) {
        const snap = await window.db.collection(`users/${uid}/tasks`).get();
        return snap.docs.map(d => d.data());
    },

    // Listener em tempo real das tarefas (para sincronização entre abas/dispositivos)
    listenTasks(uid, callback) {
        return window.db.collection(`users/${uid}/tasks`).onSnapshot(snap => {
            const tasks = snap.docs.map(d => d.data());
            callback(tasks);
        });
    },

    // Salva múltiplas tarefas de uma vez (import em lote)
    async batchSaveTasks(uid, tasks) {
        const batch = window.db.batch();
        tasks.forEach(task => {
            const id = task.__backendId || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2));
            const ref = window.db.doc(`users/${uid}/tasks/${id}`);
            batch.set(ref, { ...task, __backendId: id }, { merge: true });
        });
        return batch.commit();
    }
};
