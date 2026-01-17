# 🚀 Roadmap de Features - Pocket_Wise

**Última atualização:** 17 de Janeiro de 2026

---

## 📊 Visão Geral

| # | Feature | Impacto | Complexidade | Prioridade | Status |
|---|---------|---------|--------------|------------|--------|
| 1 | Caixinhas/Potes (Objetivos) | 🔥🔥🔥 Alto | Média | **P0 - MVP** | 📋 Planejado |
| 2 | Rebalanceamento Inteligente | 🔥🔥🔥 Alto | Alta | **P0 - MVP** | 📋 Planejado |
| 3 | Gestão de Saldo Mensal | 🔥🔥 Médio-Alto | Média | **P1 - V1** | 📋 Planejado |
| 4 | Aba de Assinaturas | 🔥🔥 Médio | Baixa | **P1 - V1** | 📋 Planejado |
| 5 | Editar Nome da Família | 🔥 Baixo | Muito Baixa | **P2 - Quick Win** | 📋 Planejado |

---

## 🎯 Fases de Implementação

### **Fase 0: Quick Win** (1-2 dias)
- ✅ Feature 5: Editar nome da família
- **Justificativa:** Simples, rápido, resolve dor imediata

### **Fase 1: MVP Caixinhas** (1-2 semanas)
- 📦 Feature 1: Sistema completo de Caixinhas/Potes
- **Justificativa:** Base para outras features (rebalanceamento, gestão de saldo)

### **Fase 2: Rebalanceamento** (2 semanas)
- 🔄 Feature 2: Rebalanceamento Inteligente
- **Justificativa:** Alto impacto, depende de caixinhas

### **Fase 3: Gestão de Saldo** (1 semana)
- 💰 Feature 3: Gestão de Saldo Mensal
- **Justificativa:** Complementa caixinhas + rebalanceamento

### **Fase 4: Assinaturas** (1-2 semanas)
- 📱 Feature 4: Aba de Assinaturas
- **Justificativa:** Independente, "nice to have"

---

## 📦 Feature 1: Caixinhas/Potes de Objetivos

### Conceito
Sistema de "poupança direcionada" onde o usuário guarda dinheiro para objetivos específicos, separado do orçamento mensal.

### Funcionalidades

#### 1.1 Criar Caixinha
- Nome, meta financeira, prazo, ícone
- Tipos: Objetivo, Reserva de Emergência, Investimento

#### 1.2 Alimentar Caixinha
- **Momento 1:** Durante planejamento mensal
- **Momento 2:** Fim do mês (sobras)

#### 1.3 Usar Caixinha
- Adicionar saldo da caixinha ao planejamento do mês específico

#### 1.4 Dashboard de Caixinhas
- Visualização de progresso
- Barras de progresso
- Cálculo automático de quanto falta

### Estrutura de Banco de Dados

```sql
CREATE TABLE caixinhas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'objetivo', 'emergencia', 'investimento'
  meta_valor DECIMAL(10,2),
  prazo_data DATE,
  icone VARCHAR(50),
  saldo_atual DECIMAL(10,2) DEFAULT 0,
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transacoes_caixinhas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixinha_id UUID REFERENCES caixinhas(id),
  valor DECIMAL(10,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- 'deposito', 'retirada'
  descricao TEXT,
  origem_mes_referencia DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tarefas de Implementação
- [ ] Criar migrations para tabelas
- [ ] Criar models no Prisma
- [ ] API endpoints (CRUD)
- [ ] Tela de criação de caixinha
- [ ] Dashboard de caixinhas
- [ ] Integração com planejamento mensal
- [ ] Modal de alocação de saldo
- [ ] Testes unitários e E2E

---

## 🔄 Feature 2: Rebalanceamento Inteligente

### Conceito
Quando uma categoria estoura, o sistema sugere automaticamente de onde tirar dinheiro para cobrir o déficit.

### Funcionalidades

#### 2.1 Detecção de Estouro
- Monitoramento em tempo real
- Alertas quando categoria excede orçamento

#### 2.2 Sugestões Inteligentes
**Prioridades (do melhor para o pior):**
1. Categorias Desejáveis com saldo sobrando
2. Categorias Importantes com muito saldo (>50%)
3. Caixinhas (com autorização)
4. Categorias Essenciais (última opção)

#### 2.3 Modal de Rebalanceamento
- Sugestões automáticas
- Transferência manual entre categorias
- Preview do impacto

### Estrutura Necessária

```typescript
enum PrioridadeCategoria {
  ESSENCIAL = 'essencial',     // Moradia, Saúde, Alimentação
  IMPORTANTE = 'importante',   // Transporte, Educação
  DESEJAVEL = 'desejavel'      // Lazer, Vestuário
}
```

### Tarefas de Implementação
- [ ] Adicionar campo `prioridade` em categorias
- [ ] Sistema de detecção de estouro
- [ ] Algoritmo de sugestões inteligentes
- [ ] Modal de rebalanceamento
- [ ] API de transferência entre categorias
- [ ] Logs de rebalanceamento
- [ ] Testes do algoritmo

---

## 💰 Feature 3: Gestão de Saldo Mensal

### Conceito
Sistema que gerencia sobras/déficits mensais e força decisão sobre o que fazer com o dinheiro.

### Funcionalidades

#### 3.1 Fim do Mês - Saldo Positivo
- Modal de alocação de sobras
- Opções: Caixinhas, Próximo mês, Decidir depois

#### 3.2 Fim do Mês - Déficit
- Modal de cobertura de déficit
- Sugestão de usar Reserva de Emergência

#### 3.3 Saldos Pendentes
- Widget no dashboard
- Histórico de saldos não alocados

### Estrutura de Banco de Dados

```sql
CREATE TABLE saldos_pendentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  mes_referencia DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- 'sobra', 'deficit'
  alocado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tarefas de Implementação
- [ ] Criar migration para saldos_pendentes
- [ ] Tela de fechamento de mês
- [ ] Modal de alocação de sobras
- [ ] Modal de cobertura de déficit
- [ ] Widget de saldos pendentes
- [ ] API endpoints
- [ ] Testes

---

## 📱 Feature 4: Aba de Assinaturas

### Conceito
Página dedicada para gerenciar assinaturas recorrentes com controles especiais.

### Funcionalidades

#### 4.1 Tela Principal
- Lista de assinaturas ativas
- Total mensal e anual
- Filtros

#### 4.2 Cadastrar Assinatura
- Nome, valor, frequência, dia de cobrança
- Upload de logo ou biblioteca pré-cadastrada
- Geração automática de lançamentos futuros

#### 4.3 Cancelar Assinatura
- Seleção de último mês de cobrança
- Remoção automática de lançamentos futuros

#### 4.4 Atualizar Valor
- Histórico de valores
- Data de início do novo valor

#### 4.5 Biblioteca de Logos
- Logos pré-cadastrados (Netflix, Spotify, etc.)
- Upload manual

### Estrutura de Banco de Dados

```sql
CREATE TABLE assinaturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  nome VARCHAR(100) NOT NULL,
  logo_url TEXT,
  valor DECIMAL(10,2) NOT NULL,
  frequencia VARCHAR(20) DEFAULT 'mensal',
  dia_cobranca INTEGER,
  categoria_id UUID REFERENCES categorias(id),
  primeira_cobranca DATE NOT NULL,
  ultima_cobranca DATE,
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE historico_valores_assinatura (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assinatura_id UUID REFERENCES assinaturas(id),
  valor_antigo DECIMAL(10,2),
  valor_novo DECIMAL(10,2),
  vigencia_inicio DATE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tarefas de Implementação
- [ ] Criar migrations
- [ ] CRUD de assinaturas
- [ ] Página dedicada de assinaturas
- [ ] Sistema de cancelamento
- [ ] Atualização de valor
- [ ] Biblioteca de logos (20-30 principais)
- [ ] Geração automática de lançamentos
- [ ] Testes

---

## ✏️ Feature 5: Editar Nome da Família

### Conceito
Permitir que usuários editem o nome de suas famílias.

### Funcionalidades
- Campo editável na página de configurações
- Validação de nome
- Atualização em tempo real

### Estrutura de Banco de Dados

```sql
ALTER TABLE families ADD COLUMN nome_editavel VARCHAR(100);
ALTER TABLE families ADD COLUMN pode_editar_nome BOOLEAN DEFAULT TRUE;
```

### Tarefas de Implementação
- [ ] Migration para adicionar campos
- [ ] Atualizar schema do Prisma
- [ ] API endpoint de atualização
- [ ] UI na página de configurações
- [ ] Validações
- [ ] Testes

---

## 📝 Notas Técnicas Importantes

### Priorização de Categorias
```typescript
enum PrioridadeCategoria {
  ESSENCIAL = 'essencial',
  IMPORTANTE = 'importante',
  DESEJAVEL = 'desejavel'
}
```

### Caixinha de Emergência - Recomendação
- Sugerir 6 meses de despesas fixas
- Cálculo automático baseado em histórico

### Integração Assinaturas → Lançamentos
- Geração automática dos próximos 12 meses
- Cancelamento remove lançamentos futuros
- Atualização de valor mantém histórico

---

## 🎯 Próximos Passos

1. **Imediato:** Implementar Feature 5 (Quick Win)
2. **Curto Prazo (30 dias):** Features 1 e 2
3. **Médio Prazo (60-90 dias):** Features 3 e 4

---

## 📊 Métricas de Sucesso

### Feature 1 - Caixinhas
- Número de caixinhas criadas por usuário
- Taxa de uso (usuários que alimentam regularmente)
- Valor médio guardado

### Feature 2 - Rebalanceamento
- Número de rebalanceamentos realizados
- Taxa de aceitação de sugestões automáticas
- Redução de categorias estouradas

### Feature 3 - Gestão de Saldo
- % de saldos alocados vs pendentes
- Tempo médio para alocar saldos
- % de meses fechados no verde vs vermelho

### Feature 4 - Assinaturas
- Número de assinaturas cadastradas
- Valor médio de assinaturas por usuário
- Taxa de cancelamento

### Feature 5 - Editar Nome
- % de usuários que editam nome da família

---

## 🔧 Dependências Técnicas

### Feature 1 → Feature 2
- Rebalanceamento precisa de caixinhas para sugerir Reserva de Emergência

### Feature 1 → Feature 3
- Gestão de saldo precisa de caixinhas para alocar sobras

### Todas → Sistema de Categorias
- Todas dependem do sistema de categorias estar funcionando

---

**Documento vivo - será atualizado conforme progresso**
