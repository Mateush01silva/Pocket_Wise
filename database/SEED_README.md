# 🌱 Script de Seed - Dados de Teste

Este script popula o banco de dados com dados realistas de teste para facilitar o desenvolvimento e testes da aplicação Pocket Wise.

## 📋 O Que o Script Cria

### 💳 **3 Cartões de Crédito**
- **Nubank** (roxo)
  - Fecha: dia 15
  - Vence: dia 23
  - Limite: R$ 5.000

- **Inter** (laranja)
  - Fecha: dia 10
  - Vence: dia 20
  - Limite: R$ 3.000

- **Itaú** (azul)
  - Fecha: dia 5
  - Vence: dia 15
  - Limite: R$ 8.000

### 📂 **~35 Subcategorias**
O script cria subcategorias para todas as categorias principais:

- **Alimentação**: Supermercado, Restaurantes, Delivery, Padaria, Lanchonete
- **Transporte**: Combustível, Uber/Taxi, Ônibus/Metrô, Manutenção, Estacionamento
- **Moradia**: Aluguel, Condomínio, Energia, Água, Internet, Gás
- **Saúde**: Farmácia, Consultas, Exames, Plano de Saúde
- **Lazer**: Cinema, Streaming, Viagens, Eventos, Hobbies
- **Educação**: Cursos Online, Livros, Material Escolar
- **Receitas**: Salário CLT, Freelance, Bônus

### 💰 **~65 Transações (Lançamentos)**

#### **Novembro 2024** (~30 transações)
- **Receitas**: R$ 6.700,00
  - Salário CLT: R$ 5.500
  - Freelance: R$ 1.200

- **Despesas**: R$ 5.200,00 (aprox.)
  - Alimentação: ~R$ 1.100
  - Moradia: R$ 2.245
  - Transporte: R$ 895
  - Saúde: R$ 785
  - Lazer: R$ 255
  - Educação: R$ 215

#### **Dezembro 2024** (~35 transações)
- **Receitas**: R$ 7.800,00
  - Salário CLT: R$ 5.500
  - Freelance: R$ 800
  - 13º Salário: R$ 1.500

- **Despesas**: R$ 6.500,00 (aprox.) - **maiores devido às festas**
  - Alimentação: ~R$ 1.960 (compras de Natal)
  - Moradia: R$ 2.284
  - Transporte: R$ 875
  - Saúde: R$ 695
  - Lazer: R$ 1.410 (presentes e festas)
  - Educação: R$ 145

### 📊 **2 Orçamentos Mensais**

#### **Novembro 2024** (Fechado)
- Meta de Poupança: R$ 1.000
- Categorias orçadas com valores realistas
- Prioridades definidas (Essencial, Importante, Desejável)

#### **Dezembro 2024** (Ativo)
- Meta de Poupança: R$ 1.500
- Valores maiores para Alimentação e Lazer (festas de fim de ano)
- Orçamento adaptado para época de festas

---

## 🚀 Como Executar

### Pré-requisitos
1. ✅ Ter executado o script `fix_family_id_issue.sql`
2. ✅ Ter uma conta criada com o email: `silva.mateush01@gmail.com`
3. ✅ Ter categorias básicas já criadas no sistema

### Passo a Passo

1. **Acesse o Supabase SQL Editor**
   ```
   https://app.supabase.com/project/ryqlnvtnlvriiuepheap/sql/new
   ```

2. **Copie o conteúdo do arquivo**
   ```bash
   database/seed_test_data.sql
   ```

3. **Cole no SQL Editor**

4. **Execute o script** (Run ou `Ctrl/Cmd + Enter`)

5. **Aguarde as mensagens de confirmação**
   ```
   ✅ SEED CONCLUÍDO COM SUCESSO!
   📊 RESUMO:
      • Cartões: 3
      • Categorias: XX
      • Subcategorias: 35
      • Lançamentos: 65
      • Orçamentos: 2
   ```

6. **Recarregue a aplicação**
   - Faça logout
   - Faça login novamente
   - Explore o Dashboard com dados reais!

---

## 📊 Características dos Dados

### Realismo
- ✅ Valores de gastos realistas para classe média brasileira
- ✅ Distribuição natural ao longo do mês
- ✅ Variação entre formas de pagamento
- ✅ Mix de débito, crédito, PIX, dinheiro
- ✅ Gastos maiores em dezembro (festas)

### Diversidade
- ✅ Todas as categorias cobertas
- ✅ Diferentes cartões utilizados
- ✅ Transações pagas e pendentes
- ✅ Receitas e despesas balanceadas
- ✅ Observações descritivas

### Utilidade
- ✅ Permite testar filtros e buscas
- ✅ Gera gráficos significativos
- ✅ Testa paginação (65 registros)
- ✅ Valida cálculos de orçamento
- ✅ Testa alertas de gastos

---

## 🎯 O Que Você Pode Testar

### Dashboard
- ✅ Cards de estatísticas (Receitas, Despesas, Saldo)
- ✅ Gráfico de pizza (gastos por categoria)
- ✅ Gráfico de barras (receitas x despesas)
- ✅ Lista de transações recentes
- ✅ Cards de orçamento

### Transações
- ✅ Filtrar por tipo (receita/despesa)
- ✅ Filtrar por categoria
- ✅ Filtrar por cartão
- ✅ Filtrar por período
- ✅ Buscar por texto
- ✅ Paginação

### Cartões
- ✅ Visualizar cartões criados
- ✅ Ver limite e uso
- ✅ Faturas por cartão

### Categorias
- ✅ Visualizar hierarquia (categorias e subcategorias)
- ✅ Ver gastos por categoria
- ✅ Ícones e cores personalizados

### Orçamentos
- ✅ Comparar planejado x realizado
- ✅ Ver alertas de gastos
- ✅ Acompanhar meta de poupança
- ✅ Envelopes por categoria

---

## 🔄 Executar Novamente

Para limpar e reexecutar o seed:

```sql
-- CUIDADO: Isso apaga TODOS os dados!
DELETE FROM lancamentos WHERE family_id = (SELECT family_id FROM users WHERE email = 'silva.mateush01@gmail.com');
DELETE FROM categorias_budget WHERE orcamento_id IN (SELECT id FROM orcamentos_mensais WHERE family_id = (SELECT family_id FROM users WHERE email = 'silva.mateush01@gmail.com'));
DELETE FROM orcamentos_mensais WHERE family_id = (SELECT family_id FROM users WHERE email = 'silva.mateush01@gmail.com');
DELETE FROM cartoes WHERE family_id = (SELECT family_id FROM users WHERE email = 'silva.mateush01@gmail.com');
DELETE FROM categorias WHERE family_id = (SELECT family_id FROM users WHERE email = 'silva.mateush01@gmail.com') AND categoria_pai_id IS NOT NULL;

-- Depois execute novamente o seed_test_data.sql
```

---

## ⚠️ Notas Importantes

1. **Email Específico**: O script só funciona para o email `silva.mateush01@gmail.com`
   - Se quiser usar outro email, edite a variável no início do script

2. **Categorias Existentes**: O script assume que já existem categorias básicas
   - Se não houver, ele pulará a criação de subcategorias para aquela categoria

3. **Conflitos**: O script usa `ON CONFLICT DO NOTHING` para evitar duplicações
   - É seguro executar múltiplas vezes

4. **Datas**: Os dados são de Novembro e Dezembro de 2024
   - Você pode editar as datas no script se preferir outro período

---

## 📈 Próximos Passos Após o Seed

1. **Explore o Dashboard**
   - Veja os gráficos com dados reais
   - Analise os cards de estatísticas

2. **Teste os Filtros**
   - Filtre transações por categoria
   - Filtre por período
   - Busque por palavras-chave

3. **Analise os Orçamentos**
   - Compare planejado vs realizado
   - Veja os alertas de gastos
   - Acompanhe as metas

4. **Crie Novos Dados**
   - Adicione novas transações
   - Crie novos orçamentos
   - Teste a funcionalidade completa

---

## 🐛 Troubleshooting

### "Usuário não encontrado"
- Certifique-se de que você criou uma conta com o email `silva.mateush01@gmail.com`
- Ou edite o email no script

### "Usuário não tem family_id"
- Execute o script `fix_family_id_issue.sql` primeiro

### "Nenhuma categoria encontrada"
- Crie categorias básicas manualmente antes de executar o seed
- Ou importe categorias de outro script

### Dados não aparecem no app
- Faça logout e login novamente
- Limpe o cache do navegador
- Verifique se está logado com o email correto

---

**Criado em:** 2026-01-15
**Versão:** 1.0
