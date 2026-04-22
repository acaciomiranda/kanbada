# 📋 Kanbada - Gestão Inteligente de Tarefas

**Kanbada** é um gerenciador de tarefas dinâmico no estilo Kanban projetado para máxima produtividade, simplicidade e personalização. Inspirado em plataformas como Trello e Asana, ele oferece uma interface moderna em *Dark Mode*, suportando fluxos de trabalho avançados que combinam beleza visual e funcionalidades completas.

## 🚀 Principais Funcionalidades

- **Gerenciamento Dinâmico:** Crie, edite e organize projetos e colunas conforme sua metodologia de trabalho.
- **Cartões Detalhados:** Adicione prazo, etiquetas (tags) com cores customizáveis, responsáveis e descrições profundas.
- **Gestão de Status Dinâmica:** Arraste e solte cartões (Drag & Drop) entre colunas ou altere rapidamente o status diretamente pelo seletor dentro da tarefa.
- **Interatividade Total:** Edição com apenas um clique sobre o card, com acesso imediato a arquivos anexados (suporte indicativo de até 1GB).
- **Sistema de Reações:** Deixe curtidas (👍) ou amei (❤️) para facilitar a comunicação e priorização.
- **Espaço Seguro:** Tarefas concluídas podem ser **Arquivadas** por projeto. Tarefas apagadas vão para a **Reciclagem (Lixeira)** e ficam aguardando por 7 dias, podendo ser restauradas ou excluídas permanentemente.
- **Organização Centralizada:** O projeto padrão "Geral" unifica as tarefas que não possuem hierarquia definida, facilitando o gerenciamento global.
- **Backup e Exportação:** Exporte as tarefas e as importe via JSON, garantindo a integridade dos seus dados. O suporte à importação CSV via Google Sheets facilita a transição a partir do Asana.

## 🛠️ Tecnologias e Dependências

- **Frontend Core:** HTML5, CSS3, e JavaScript ES6+ (Vanilla).
- **Design System:** [Tailwind CSS](https://tailwindcss.com/) via CDN para estilização rápida e responsiva.
- **Ícones Ativos:** [Lucide Icons](https://lucide.dev/) para uma iconografia elegante e profissional.
- **Drag & Drop:** [SortableJS](https://sortablejs.github.io/Sortable/) garantindo fluidez ao mover cartões no quadro.
- **Leitura de Dados (XLSX/CSV):** [SheetJS](https://sheetjs.com/) utilizado na lógica de extração inteligente de importações.
- **Armazenamento Local:** Uso nativo de `localStorage` para retenção dos dados no lado do cliente.

## 📂 Estrutura de Diretórios

O projeto foi organizado de forma escalável e didática:

```text
kanbada/
├── .gitignore                   # Arquivos ignorados pelo Git (dados locais, planilhas sensíveis)
├── README.md                    # Documentação do projeto
├── index.html                   # Página principal que contêm os templates e interface global
└── src/
    ├── styles/
    │   └── style.css            # Customizações adicionais e reset padrão
    ├── components/
    │   └── Card.js              # Template string que renderiza os cartões individualmente
    ├── utils/
    │   └── data_mapper.js       # Tratamento lógico e conversor para dados importados (Ex: Asana -> Kanbada)
    └── app.js                   # Lógica central da aplicação (Manipulação DOM, LocalStorage, Filtros, CRUD)
```

## 🎮 Como Executar (Localmente)

Por ser baseado em Vanilla JavaScript e focado no lado do cliente (`localStorage`), não há necessidade de servidor backend para testes iniciais.

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/acaciomiranda/kanbada.git
   ```

2. **Entre no diretório do projeto:**
   ```bash
   cd kanbada
   ```

3. **Inicie um servidor local (opcional, mas recomendado devido à política de CORS ao usar módulos JS):**
   * *Com Node.js (via pacote `serve`):* `npx serve .`
   * *Com VS Code:* Utilize a extensão **Live Server**.

4. Acesse via `http://localhost:3000` ou no endereço da porta informada.

## 🤝 Contribuindo

Se você tiver alguma ideia ou encontrar algum erro, sinta-se à vontade para enviar um Pull Request. Melhorias como sincronização em tempo real (ex: Firebase), upload binário em buckets S3 ou suporte SSR podem ser boas extensões para futuras versões.

---
Feito com dedicação para gerenciar suas tarefas da melhor forma possível! 🎯
