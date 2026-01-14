# 🔧 Correção de Ícones: Texto → Emoji

## 📋 Problema

As categorias estavam salvando **nomes de ícones em inglês** (ex: `utensils`, `car`, `home`) ao invés de **emojis reais** (ex: 🍴, 🚗, 🏠).

Isso causava confusão na interface, mostrando texto em inglês ao lado dos nomes em português.

## ✅ Solução

### 1️⃣ Corrigir Dados Existentes (Script SQL)

Execute o script SQL no Supabase para converter os ícones existentes:

```bash
# Arquivo: 002_fix_icon_names_to_emojis.sql
```

**Como executar no Supabase:**

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Clique em **"New Query"**
4. Cole o conteúdo do arquivo `002_fix_icon_names_to_emojis.sql`
5. Clique em **"Run"**

O script irá:
- ✅ Converter todos os nomes em inglês para emojis correspondentes
- ✅ Aplicar ícone padrão (📦) para textos não reconhecidos
- ✅ Mostrar log de quantas categorias foram corrigidas

### 2️⃣ Melhorias no Interface (CategoryModal)

Agora o modal de categoria tem um **seletor visual de emojis**:

- ✅ **60 emojis para Despesas** organizados por tema:
  - 🍴 Alimentação
  - 🚗 Transporte
  - 🏠 Moradia
  - ❤️ Saúde
  - 😊 Lazer
  - 📚 Educação
  - 👕 Vestuário
  - 💡 Utilidades
  - 🐶 Pets
  - 🔧 Manutenção
  - E mais...

- ✅ **25 emojis para Receitas**:
  - 💰 Salário
  - 💵 Freelance
  - 📈 Investimentos
  - 🎁 Bônus
  - E mais...

- ✅ **Seleção por clique**: Não precisa mais digitar o emoji manualmente
- ✅ **Preview em tempo real**: Mostra o emoji selecionado no label
- ✅ **Troca automática**: Ao mudar de Despesa→Receita (ou vice-versa), os emojis mudam automaticamente
- ✅ **Scroll suave**: Lista com scroll para não ocupar muito espaço

## 🎯 Como Usar (Pós-Migração)

1. **Executar script SQL** no Supabase (uma única vez)
2. **Recarregar a aplicação** no navegador
3. **Verificar** que todos os ícones agora aparecem como emojis
4. **Criar novas categorias** usando o seletor visual (sem mais textos em inglês!)

## 🐛 Verificação

Após executar o script, você pode verificar se ficou algum ícone problemático:

```sql
-- Ver categorias que ainda têm texto ao invés de emoji
SELECT id, nome, tipo, icone
FROM categorias
WHERE icone ~ '^[a-zA-Z\-]+$';
```

Se retornar linhas, significa que há ícones com texto que não foram reconhecidos pelo script. Você pode:
- Editá-los manualmente no Supabase
- Ou editar a categoria na aplicação usando o novo seletor de emojis

## 📝 Observações

- O script é **idempotente**: Pode executar múltiplas vezes sem problemas
- Faz correspondência por **nome do ícone** e **nome da categoria** (usa ILIKE para buscar)
- Usa regex para identificar textos em inglês: `icone ~ '^[a-zA-Z\-]+$'`
- Preserva emojis que já estão corretos
