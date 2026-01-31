# Melhorias Pendentes - Pocket Wise

Este arquivo documenta melhorias identificadas pelo usuário. Todas as melhorias foram implementadas!

---

## Resolvidos

### Sessão 3
- [x] **Dashboard - Contas a Pagar Vencidas** - Ao clicar "Ver todas" no widget de contas a pagar, agora abre a página de transações já filtrada por despesas pendentes. Adicionado também botão "Ver todas as vencidas" na seção de contas vencidas que filtra apenas as vencidas (`UpcomingBillsWidget.tsx`, `Transactions.tsx`)
- [x] **Gráfico de Evolução de Saldo - Escala** - Implementada escala dinâmica no gráfico de fluxo de caixa. Quando a variação é pequena em relação ao patrimônio (< 20%), o gráfico usa escala relativa ao invés de começar do zero, permitindo visualizar melhor as variações (`CashFlow.tsx`)

### Sessão 2
- [x] **Modal de edição de orçamento** - Aumentada a largura do modal para `5xl`, layout de 2 colunas (receitas/despesas) em telas grandes, adicionada busca/filtro de categorias (`BudgetPlanningModal.tsx`, `Modal.tsx`)
- [x] **Editar envelope individual** - Ao clicar em um envelope e abrir o modal de transações, agora é possível editar o valor orçado diretamente clicando no ícone de editar ao lado do valor orçado (`CategoryTransactionsModal.tsx`, `EnvelopeDigital` type atualizado)

### Sessão 1
- [x] **Deletar notificações** - Adicionada funcionalidade para dispensar alertas na página de orçamentos (`BudgetAlertsCard.tsx`)
- [x] **Bug do mês errado** - Corrigido o bug onde a mensagem mostrava "janeiro" ao invés de "fevereiro" (problema de timezone com `new Date()`, substituído por `parseISO()`)
- [x] **Copiar mês anterior não funciona** - Corrigida a função que não copiava as categorias budget porque buscava do estado local ao invés do banco de dados

---

*Última atualização: Janeiro 2026*
