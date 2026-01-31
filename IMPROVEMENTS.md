# Melhorias Pendentes - Pocket Wise

Este arquivo documenta melhorias identificadas pelo usuário que ainda precisam ser implementadas.

---

## 1. Dashboard - Contas a Pagar Vencidas - Filtro Automático

**Problema:** No Dashboard, quando o usuário clica em "Ver todas" nas Contas a Pagar Vencidas, a página de Transações abre sem nenhum filtro aplicado. Deveria abrir já filtrado para mostrar apenas as contas vencidas.

**Solução sugerida:**
- Passar parâmetros de filtro via URL ou state quando navegar
- Ex: `/transacoes?status=pendente&vencidas=true` ou usar React Router state
- Na página de Transações, ler esses parâmetros e aplicar o filtro automaticamente

**Arquivos:**
- `src/pages/Dashboard.tsx` (onde está o link "Ver todas")
- `src/pages/Transacoes.tsx` (para aplicar o filtro)

---

## 2. Gráfico de Evolução de Saldo - Escala Inadequada

**Problema:** O gráfico de evolução de saldo mostra uma "linha reta" quando o patrimônio é alto (~190k) mas as variações mensais são baixas (~10k de gastos, ~13k de receitas). A escala não permite visualizar as mudanças.

**Soluções sugeridas:**

### Opção A: Escala Relativa
- Usar escala relativa que começa próximo ao valor mínimo do período
- Ex: Se saldo varia entre 180k e 195k, o gráfico mostra apenas essa faixa

### Opção B: Gráfico de Variação
- Mostrar um gráfico separado com as variações (delta) em vez do valor absoluto
- Ex: Mostrar +3k, -2k, +5k ao invés de 190k, 188k, 193k

### Opção C: Dual Axis
- Mostrar o saldo acumulado em um eixo e as variações em outro

**Arquivos relacionados:**
- Componente de gráfico de evolução de saldo (verificar em `src/components/`)

---

## Resolvidos

### Sessão 2
- [x] **Modal de edição de orçamento** - Aumentada a largura do modal para `5xl`, layout de 2 colunas (receitas/despesas) em telas grandes, adicionada busca/filtro de categorias (`BudgetPlanningModal.tsx`, `Modal.tsx`)
- [x] **Editar envelope individual** - Ao clicar em um envelope e abrir o modal de transações, agora é possível editar o valor orçado diretamente clicando no ícone de editar ao lado do valor orçado (`CategoryTransactionsModal.tsx`, `EnvelopeDigital` type atualizado)

### Sessão 1
- [x] **Deletar notificações** - Adicionada funcionalidade para dispensar alertas na página de orçamentos (`BudgetAlertsCard.tsx`)
- [x] **Bug do mês errado** - Corrigido o bug onde a mensagem mostrava "janeiro" ao invés de "fevereiro" (problema de timezone com `new Date()`, substituído por `parseISO()`)
- [x] **Copiar mês anterior não funciona** - Corrigida a função que não copiava as categorias budget porque buscava do estado local ao invés do banco de dados

---

*Última atualização: Janeiro 2026*
