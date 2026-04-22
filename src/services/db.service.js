import { db } from './firebase.js?v=4';
import {
    doc, collection, getDocs, setDoc, updateDoc,
    deleteDoc, onSnapshot, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const dbService = {
    // Salva/atualiza perfil do usuário
    async saveProfile(uid, data) {
        return setDoc(doc(db, 'users', uid, 'config', 'profile'), data, { merge: true });
    },

    // Salva configurações (projetos e colunas)
    async saveConfig(uid, projects, columns) {
        return setDoc(doc(db, 'users', uid, 'config', 'board'), { projects, columns });
    },

    // Carrega configurações
    async loadConfig(uid) {
        const snap = await getDocs(collection(db, 'users', uid, 'config'));
        const result = {};
        snap.forEach(d => { result[d.id] = d.data(); });
        return result;
    },

    // Salva uma tarefa individual (cria ou atualiza)
    async saveTask(uid, task) {
        const id = task.__backendId || crypto.randomUUID();
        const ref = doc(db, 'users', uid, 'tasks', id);
        await setDoc(ref, { ...task, __backendId: id, updatedAt: serverTimestamp() }, { merge: true });
        return id;
    },

    // Deleta uma tarefa do Firestore (exclusão permanente)
    async deleteTask(uid, taskId) {
        return deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
    },

    // Carrega todas as tarefas de uma vez (para o carregamento inicial)
    async loadAllTasks(uid) {
        const snap = await getDocs(collection(db, 'users', uid, 'tasks'));
        return snap.docs.map(d => d.data());
    },

    // Listener em tempo real das tarefas (para sincronização entre abas/dispositivos)
    listenTasks(uid, callback) {
        return onSnapshot(collection(db, 'users', uid, 'tasks'), snap => {
            const tasks = snap.docs.map(d => d.data());
            callback(tasks);
        });
    },

    // Salva múltiplas tarefas de uma vez (import em lote)
    async batchSaveTasks(uid, tasks) {
        const batch = writeBatch(db);
        tasks.forEach(task => {
            const id = task.__backendId || crypto.randomUUID();
            const ref = doc(db, 'users', uid, 'tasks', id);
            batch.set(ref, { ...task, __backendId: id }, { merge: true });
        });
        return batch.commit();
    }
};
