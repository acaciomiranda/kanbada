# 📋 Kanbada - Gestão Inteligente de Tarefas

**Kanbada** é um gerenciador de tarefas dinâmico no estilo Kanban projetado para máxima produtividade, simplicidade e personalização. Inspirado em plataformas como Trello e Asana, ele oferece uma interface moderna em *Dark Mode*, suportando fluxos de trabalho avançados que combinam beleza visual e funcionalidades completas.

## 🚀 Principais Funcionalidades

- **Gerenciamento Dinâmico:** Crie, edite e organize projetos e colunas conforme sua metodologia de trabalho.
- **✅ Subtarefas Interativas:** Adicione listas de verificação dentro de cada tarefa. Conclua subtarefas diretamente no cartão do Kanban sem abrir modais, com barra de progresso em tempo real.
- **📋 Vista em Lista (List View):** Alterne entre o quadro Kanban e uma tabela plana (estilo Asana/Excel) para uma visão macro de todas as tarefas.
- **🎨 Cores Personalizadas:** Escolha cores específicas para cada projeto na sidebar para uma organização visual mais intuitiva.
- **⚡ Ações em Massa (Bulk Operations):** Selecione múltiplas tarefas simultaneamente para:
  - **Mover para Coluna:** Transfira várias tarefas de uma só vez para qualquer coluna existente.
  - **Seleção Inteligente:** Selecione tudo ou todas as tarefas de um status específico com um clique.
  - **Arquivamento e Exclusão:** Limpe seu quadro rapidamente arquivando ou removendo itens em lote.
- **🛡️ Auto-Cura de Dados:** Sistema inteligente que detecta IDs duplicados ou ausentes, normalizando o banco de dados local automaticamente para evitar perda de informações.
- **💎 Interface Premium:** Modais customizados substituem os diálogos nativos do sistema (prompt/confirm), garantindo uma experiência fluida e integrada.
- **📊 Relatórios Avançados:** Dashboard visual com KPIs (total, concluídas, taxa de conclusão, atrasadas), progresso por coluna, por projeto e ranking de responsáveis.
- **🏷️ Cartões Detalhados:** Adicione prazo, etiquetas (tags) com cores customizáveis, responsáveis e descrições ricas.
- **🔄 Gestão de Status Dinâmica:** Arraste e solte cartões (Drag & Drop) entre colunas ou altere rapidamente o status diretamente pelo card.
- **🔔 Notificações & Feedback:** Sistema de alertas internos com opção de limpeza rápida para manter o foco.
- **📁 Espaço Seguro:** Tarefas concluídas podem ser **Arquivadas**. Itens apagados vão para a **Reciclagem** por 7 dias antes da exclusão permanente.
- **📲 Experiência Mobile:** Interface totalmente responsiva, otimizada para toques e visualização em telas pequenas.
- **📥 Exportação e Importação:** Backup em JSON ou planilhas CSV compatíveis com o Asana (incluindo indicadores de status ativo/arquivado).

## 🛠️ Tecnologias e Dependências

- **Frontend Core:** HTML5, CSS3, e JavaScript ES6+ (Vanilla).
- **Design System:** [Tailwind CSS](https://tailwindcss.com/) via CDN para estilização rápida e responsiva.
- **Ícones Ativos:** [Lucide Icons](https://lucide.dev/) com otimização de renderização por escopo.
- **Drag & Drop:** [SortableJS](https://sortablejs.github.io/Sortable/) com gerenciamento de instâncias para evitar leaks de memória.
- **Leitura de Dados (XLSX/CSV):** [SheetJS](https://sheetjs.com/) para importação inteligente de dados externos.
- **Armazenamento Local:** Uso otimizado de `localStorage` para persistência offline.

## 📂 Estrutura de Diretórios

O projeto foi organizado de forma escalável e modular:

```text
kanbada/
├── .gitignore                   # Arquivos ignorados pelo Git
├── README.md                    # Documentação do projeto
├── index.html                   # Página principal e templates UI
└── src/
    ├── styles/
    │   └── style.css            # Design system, animações e tokens
    ├── components/
    │   ├── Card.js              # Componente de renderização dos cartões
    │   ├── Column.js            # Lógica de renderização de colunas
    │   └── Login.js             # Sistema de autenticação e segurança
    ├── services/
    │   └── data_mapper.js       # Tratamento de dados e importadores
    └── app.js                   # Lógica central e gerenciamento de estado
```

## 🎮 Como Executar (Localmente)

Por ser baseado em Vanilla JavaScript e focado no cliente, o Kanbada é leve e fácil de rodar:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/acaciomiranda/kanbada.git
   ```

2. **Inicie um servidor local:**
   * *Com VS Code:* Utilize a extensão **Live Server**.
   * *Com Node.js:* `npx serve .`
   * *Com Python:* `python -m http.server`

3. Acesse via `http://localhost:3000` ou no endereço da porta informada.

## 🤝 Contribuindo

Se você tiver alguma ideia ou encontrar algum erro, sinta-se à vontade para enviar um Pull Request. Melhorias sugeridas:
- Sincronização em nuvem (Firebase/Supabase).
- Upload real de arquivos para S3 ou Cloudinary.
- Temas customizáveis além do Dark Mode.

---
Feito com dedicação para gerenciar suas tarefas da melhor forma possível! 🎯
