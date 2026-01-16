# Debug - Navegação de Mês

## Problema Relatado
- Usuário não consegue avançar para Janeiro 2026
- Setinha de próximo mês não funciona
- Sistema mostra Dezembro 2025

## Investigação

### 1. Data do Sistema
```bash
$ date
# Confirmar: Fri Jan 16 ... 2026
```

### 2. Estado Inicial
- `mesAtual` inicia com: `format(startOfMonth(new Date()), 'yyyy-MM-dd')`
- Deve ser: `2026-01-01`

### 3. Problema Identificado
- Orçamento de Janeiro 2026 NÃO EXISTE no banco
- Sistema mostra último orçamento disponível (Dezembro 2025)
- useEffect busca orçamento: `getOrcamentoDoMes(mesAtual)`
- Se não encontra → `setOrcamentoAtual(null)`
- Página mostra tela vazia: "Nenhum orçamento para janeiro 2026"

### 4. Comportamento Atual
1. Usuário está em página com orçamento de Dezembro 2025
2. Clica em seta →
3. mesAtual muda para 2026-01-01
4. useEffect busca orçamento de janeiro 2026
5. Não encontra orçamento
6. Mostra tela de criar orçamento

### 5. Solução
O comportamento está CORRETO!

O problema é que:
- Badge mostra "Orçamento de dezembro 2025" (correto)
- Usuário pensa que está em dezembro
- Mas na verdade o seletor de mês já está em janeiro
- Por isso não consegue "avançar" - já está no mês atual

Preciso verificar:
- O initialize do store está criando o orçamento do mês atual?
- Ou está pegando o último orçamento disponível?
