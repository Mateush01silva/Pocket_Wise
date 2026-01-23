# 🧹 Scripts de Limpeza de Dados

Scripts para limpar dados transacionais do PocketWise, mantendo as configurações.

## 📋 O que é removido

- ❌ Todas as transações/lançamentos
- ❌ Todos os orçamentos
- ❌ Todos os envelopes digitais
- ❌ Todas as projeções e planejamentos
- ❌ Histórico de orçamentos por categoria

## ✅ O que é mantido

- ✅ Cartões de crédito
- ✅ Contas bancárias (com saldo resetado para inicial)
- ✅ Categorias e subcategorias
- ✅ Configurações de usuário/família
- ✅ Assinaturas (opcional deletar)
- ✅ Patrimônio histórico (opcional deletar)

---

## 🗄️ Para Supabase (Produção)

### Como usar:

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo de `limpar_dados_transacionais.sql`
4. Clique em **Run**

### ⚠️ Importante:

- **BACKUP**: Este script NÃO pode ser desfeito! Faça backup antes se necessário
- O script usa `BEGIN/COMMIT` para garantir atomicidade
- Após executar, os saldos das contas voltam ao saldo inicial
- Você verá uma tabela com a contagem de registros ao final

### Opcional:

Se quiser também deletar:
- **Assinaturas**: Descomente a linha `DELETE FROM assinaturas;`
- **Patrimônio**: Descomente a linha `DELETE FROM patrimonio;`

---

## 💾 Para LocalStorage (Modo MVP)

### Como usar:

1. Abra o aplicativo no navegador
2. Pressione **F12** para abrir o Console
3. Copie e cole o conteúdo de `limpar_localstorage.js`
4. Pressione **Enter**
5. Confirme se deseja recarregar a página

### ⚠️ Importante:

- **BACKUP**: Não há como desfazer! Os dados serão perdidos permanentemente
- O script mostra um resumo do que foi mantido/removido
- Uma confirmação será solicitada antes de recarregar
- Os saldos das contas voltam ao saldo inicial automaticamente

---

## 🎯 Casos de Uso

### 1. Testar o Sistema com Dados Reais

Você criou dados de teste e agora quer começar de verdade:

```
✅ Você já configurou: cartões, contas, categorias
❌ Precisa limpar: transações de teste
→ Execute o script de limpeza
→ Comece a lançar dados reais
```

### 2. Recomeçar o Mês

Quer resetar tudo e começar do zero:

```
→ Execute o script de limpeza
→ Configure novamente o patrimônio base
→ Crie orçamento do mês atual
→ Comece os lançamentos
```

### 3. Migrar de LocalStorage para Supabase

```
→ Execute limpar_localstorage.js (limpar dados antigos)
→ Configure Supabase
→ Reconfigure cartões/contas/categorias
→ Comece a usar em produção
```

---

## 🔍 Verificação Pós-Limpeza

### No Supabase:

O próprio script mostra uma tabela com contagens:
```sql
Lançamentos           | 0
Orçamentos            | 0
Envelopes             | 0
Cartões (mantidos)    | 3
Contas (mantidas)     | 2
Categorias (mantidas) | 15
```

### No LocalStorage:

Abra o Console (F12) e execute:
```javascript
Object.keys(localStorage)
  .filter(k => k.startsWith('pocketwise'))
  .forEach(k => console.log(k, localStorage.getItem(k).length + ' bytes'))
```

---

## 📝 Notas

- **Segurança**: Estes scripts só afetam dados transacionais
- **Atomicidade**: Em caso de erro, nada é deletado (ROLLBACK automático)
- **Performance**: Scripts otimizados para execução rápida
- **Logs**: Mensagens claras no console sobre cada ação

---

## 🆘 Suporte

Se algo der errado:

1. **Supabase**: Restore do backup automático (Settings > Backups)
2. **LocalStorage**: Não há backup - cuidado ao executar!
3. **Dúvidas**: Revise este README antes de executar

---

## ✨ Dicas

**Antes de limpar:**
- Anote valores importantes (patrimônio, saldos reais)
- Tire um print dos cartões cadastrados
- Export das categorias personalizadas (se houver muitas)

**Depois de limpar:**
- Configure patrimônio base atual
- Lance faturas consolidadas dos cartões (próximos meses)
- Crie despesas fixas recorrentes
- A partir daí, lance transações normalmente

**Fluxo recomendado após limpeza:**
1. 🏦 Verificar contas (saldos voltaram ao inicial)
2. 💰 Atualizar patrimônio base
3. 📋 Lançar faturas consolidadas
4. 🔄 Criar despesas recorrentes
5. 📊 Criar orçamento do mês
6. ✅ Começar a usar normalmente
