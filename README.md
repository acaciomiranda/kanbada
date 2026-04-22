# 📋 Kanbada - Gestão Inteligente de Tarefas (Cloud Edition)

**Kanbada** é um gerenciador de tarefas dinâmico no estilo Kanban projetado para máxima produtividade, simplicidade e personalização. Agora em sua versão **Cloud Native**, o projeto utiliza a infraestrutura do **Firebase** para garantir que seus dados estejam sempre seguros e acessíveis de qualquer lugar.

## 🚀 O que há de novo (v2.0 - Firebase Edition)

- **☁️ Sincronização em Nuvem:** Seus dados não ficam mais presos ao navegador. Tudo é persistido em tempo real no **Firebase Firestore**.
- **🛡️ Autenticação Segura:** Sistema de login e cadastro completo via **Firebase Auth**, com persistência de sessão e recuperação de senha.
- **📂 Gestão de Anexos:** Suporte para anexos em tarefas (limite de 1MB por arquivo no plano gratuito), salvos diretamente no banco de dados.
- **⚡ Performance Assíncrona:** Toda a lógica do app foi migrada para operações assíncronas, garantindo uma interface fluida que nunca trava durante o salvamento.
- **🔄 Arquitetura Global e Resiliente:** Scripts carregados sincronamente com Proxies de interceptação para serviços (`authService`, `dbService`), garantindo máxima estabilidade no escopo de execução.

## 🚀 Funcionalidades Principais

- **Gerenciamento Dinâmico:** Crie, edite e organize projetos e colunas conforme sua metodologia de trabalho.
- **✅ Subtarefas Interativas:** Adicione listas de verificação dentro de cada tarefa. Conclua subtarefas diretamente no cartão sem abrir modais.
- **📋 Vista em Lista (List View):** Alterne entre o quadro Kanban e uma tabela plana para uma visão macro.
- **🎨 Cores Personalizadas:** Escolha cores específicas para cada projeto para organização visual.
- **⚡ Ações em Massa (Bulk Operations):** Selecione múltiplas tarefas para mover, arquivar ou excluir de uma só vez.
- **💎 Interface Premium:** Modais customizados que substituem os diálogos nativos (prompt/confirm), garantindo uma experiência premium.
- **📊 Relatórios Avançados:** Dashboard visual com KPIs, progresso por coluna e ranking de responsáveis.
- **🔔 Notificações & Feedback:** Sistema de alertas internos para manter o fluxo de trabalho.
- **📁 Ciclo de Vida de Tarefas:** Itens apagados vão para a **Reciclagem** e itens concluídos podem ser **Arquivadas**.
- **📲 Experiência Mobile:** Totalmente responsiva e otimizada para dispositivos móveis.

## 🛠️ Tecnologias e Dependências

- **Core:** HTML5, CSS3, e JavaScript ES6+ (Carregamento Global).
- **Backend-as-a-Service:** [Firebase](https://firebase.google.com/) (SDK Compat - Auth & Firestore).
- **Design:** [Tailwind CSS](https://tailwindcss.com/) via CDN.
- **Ícones:** [Lucide Icons](https://lucide.dev/).
- **Drag & Drop:** [SortableJS](https://sortablejs.github.io/Sortable/).
- **Parsing de Dados:** [SheetJS](https://sheetjs.com/).

## 📂 Estrutura de Diretórios

```text
kanbada/
├── index.html                   # Página principal (Single Page App) c/ Config Firebase
└── src/
    ├── styles/
    │   └── style.css            # Design system e animações
    ├── components/
    │   ├── Card.js              # Renderização dos cartões (UI)
    │   ├── Column.js            # Estrutura das colunas
    │   └── Login.js             # UI de Autenticação Firebase
    ├── services/
    │   ├── auth.service.js      # Lógica de Login/Cadastro (Global)
    │   ├── db.service.js        # Operações CRUD no Firestore (Global)
    │   └── data_mapper.js       # Importação e normalização Asana
    └── app.js                   # Lógica central e Gerenciamento de Estado
```

## 🎮 Como Executar

### Pré-requisitos
1. Um projeto configurado no [Firebase Console](https://console.firebase.google.com/).
2. Ativar **Authentication** (E-mail/Senha) e **Cloud Firestore**.

### Configuração
1. Edite o bloco de configuração diretamente no `<head>` ou topo do `index.html` com as suas chaves do Firebase:
   ```html
   const firebaseConfig = {
       apiKey: "SUA_API_KEY",
       authDomain: "SEU_DOMINIO.firebaseapp.com",
       projectId: "SEU_PROJECT_ID"
       // ... outras chaves
   };
   ```
2. Abra o `index.html` em um servidor local (Live Server ou similar).

## 🛠️ Solução de Problemas (Troubleshooting)

Se o aplicativo carregar uma **tela em branco** na produção:

1. **Rastreamento e Cookies:** O Firebase requer acesso ao `localStorage`. Verifique se o seu navegador não está bloqueando "cookies de terceiros" ou se o modo de "Proteção Contra Rastreamento" (Brave, Safari, Edge) está muito rigoroso.
2. **Autorização de Domínio:** Certifique-se de que o domínio `acaciomiranda.com` está na lista de "Domínios Autorizados" no Console do Firebase (Autenticação > Configurações).
3. **Erros no Console:** Pressione `F12` e verifique a aba "Console". Procure por erros em vermelho. Se vir `Auth State Changed`, o Firebase inicializou corretamente.
4. **Cache:** Tente um "Hard Refresh" com `Ctrl + Shift + R`.

## 🤝 Contribuindo

Se você tiver alguma ideia ou encontrar algum erro, sinta-se à vontade para enviar um Pull Request.

---
Feito com dedicação para gerenciar suas tarefas na nuvem! 🎯
