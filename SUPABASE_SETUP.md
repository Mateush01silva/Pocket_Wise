# 🚀 Guia de Configuração do Supabase - Pocket Wise

Este guia contém todas as instruções passo a passo para configurar o Supabase no projeto Pocket Wise.

---

## 📋 Índice

1. [Criar Projeto no Supabase](#1-criar-projeto-no-supabase)
2. [Configurar Variáveis de Ambiente](#2-configurar-variáveis-de-ambiente)
3. [Executar Scripts SQL](#3-executar-scripts-sql)
4. [Configurar Autenticação](#4-configurar-autenticação)
5. [Configurar Templates de Email](#5-configurar-templates-de-email)
6. [Configurar Domínio Customizado (Opcional)](#6-configurar-domínio-customizado-opcional)
7. [Verificar Configurações de Segurança](#7-verificar-configurações-de-segurança)
8. [Testar o Fluxo de Autenticação](#8-testar-o-fluxo-de-autenticação)
9. [Deploy e Produção](#9-deploy-e-produção)

---

## 1. Criar Projeto no Supabase

### 1.1 Acesse o Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**

### 1.2 Configure o Projeto
- **Name**: `pocket-wise` (ou nome de sua preferência)
- **Database Password**: Crie uma senha forte e **salve em local seguro** (você precisará dela)
- **Region**: Escolha `South America (São Paulo)` para menor latência no Brasil
- **Pricing Plan**:
  - **Free** para desenvolvimento
  - **Pro** ($25/mês) para produção com mais recursos

### 1.3 Aguarde a Criação
- O Supabase levará ~2 minutos para provisionar o banco de dados
- Não feche a página durante este processo

---

## 2. Configurar Variáveis de Ambiente

### 2.1 Obter Credenciais do Supabase

1. No dashboard do Supabase, vá em **Settings** (ícone de engrenagem) → **API**
2. Você verá:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGc...` (chave pública, pode ser exposta no frontend)
   - **service_role key**: `eyJhbGc...` (chave privada, **NUNCA exponha no frontend**)

### 2.2 Criar Arquivo `.env.local`

Na raiz do projeto, crie o arquivo `.env.local`:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...sua-anon-key-aqui...

# Feature Flags
VITE_USE_LOCAL_STORAGE=false
```

⚠️ **IMPORTANTE**:
- Use a **anon key**, NÃO a service_role key
- Nunca commite este arquivo no Git (já está no `.gitignore`)

### 2.3 Reiniciar Servidor de Desenvolvimento

Após criar o `.env.local`:

```bash
npm run dev
```

O aplicativo agora usará Supabase ao invés de localStorage.

---

## 3. Executar Scripts SQL

### 3.1 Acessar SQL Editor

1. No dashboard do Supabase, clique em **SQL Editor** no menu lateral
2. Clique em **"New query"**

### 3.2 Executar Script de Setup

1. Abra o arquivo `database/auth/001_setup_auth_and_subscriptions.sql`
2. Copie **TODO** o conteúdo do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **"Run"** (ou pressione `Ctrl+Enter`)

### 3.3 Verificar Sucesso

Você deve ver a mensagem:

```
✅ Sistema de autenticação e assinaturas configurado com sucesso!
```

### 3.4 Verificar Tabelas Criadas

Clique em **Table Editor** no menu lateral. Você deve ver:

- ✅ `assinaturas` - Gerencia planos e trials
- ✅ `users` - Perfis de usuários (estende auth.users)

---

## 4. Configurar Autenticação

### 4.1 Habilitar Autenticação por Email

1. Vá em **Authentication** → **Providers**
2. Encontre **Email** na lista
3. Certifique-se que está **habilitado** (toggle verde)

### 4.2 Configurar URLs de Redirecionamento

1. Vá em **Authentication** → **URL Configuration**
2. Configure os seguintes campos:

**Site URL** (produção):
```
https://seudominio.com
```

**Redirect URLs** (adicione todas estas):
```
http://localhost:5173/**
http://localhost:5173/login
http://localhost:5173/app
https://seudominio.com/**
https://seudominio.com/login
https://seudominio.com/app
```

### 4.3 Configurar Confirmação de Email

1. Ainda em **Authentication** → **Email**
2. Configure:

**Confirm email**:
- ✅ **Habilitado** (recomendado para produção)
- ❌ **Desabilitado** (para testes locais mais rápidos)

**Secure email change**:
- ✅ **Habilitado** (recomendado)

---

## 5. Configurar Templates de Email

### 5.1 Acessar Templates

1. Vá em **Authentication** → **Email Templates**
2. Você verá 3 templates principais:
   - **Confirm signup** - Email de confirmação de cadastro
   - **Reset password** - Email de recuperação de senha
   - **Magic Link** - Email de login sem senha (não usado neste projeto)

### 5.2 Personalizar Template de Confirmação

Clique em **Confirm signup** e personalize:

**Subject**:
```
Bem-vindo ao PocketWise! Confirme seu email
```

**Body** (exemplo):
```html
<h2>Bem-vindo ao PocketWise! 🎉</h2>

<p>Olá {{ .Email }},</p>

<p>Obrigado por se cadastrar! Você ganhou <strong>7 dias grátis</strong> para testar todas as funcionalidades.</p>

<p>Para confirmar seu email e começar, clique no botão abaixo:</p>

<p><a href="{{ .ConfirmationURL }}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Confirmar Email</a></p>

<p>Ou copie e cole este link no seu navegador:</p>
<p>{{ .ConfirmationURL }}</p>

<p>Se você não criou esta conta, pode ignorar este email.</p>

<p>Atenciosamente,<br>Equipe PocketWise</p>
```

### 5.3 Personalizar Template de Recuperação de Senha

Clique em **Reset password** e personalize:

**Subject**:
```
Recuperação de senha - PocketWise
```

**Body** (exemplo):
```html
<h2>Recuperar sua senha</h2>

<p>Olá {{ .Email }},</p>

<p>Recebemos uma solicitação para redefinir sua senha.</p>

<p>Clique no botão abaixo para criar uma nova senha:</p>

<p><a href="{{ .ConfirmationURL }}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Redefinir Senha</a></p>

<p>Ou copie e cole este link no seu navegador:</p>
<p>{{ .ConfirmationURL }}</p>

<p>Se você não solicitou a recuperação de senha, pode ignorar este email.</p>

<p>Atenciosamente,<br>Equipe PocketWise</p>
```

### 5.4 Configurar SMTP (Opcional - Recomendado para Produção)

Por padrão, o Supabase usa um servidor SMTP interno com limite de 4 emails/hora. Para produção, configure seu próprio SMTP:

1. Vá em **Settings** → **Authentication** → **SMTP Settings**
2. Configure com seu provedor (exemplos: SendGrid, AWS SES, Mailgun):

```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: SG.xxxxxxxxxxxxx
Sender Email: noreply@seudominio.com
Sender Name: PocketWise
```

---

## 6. Configurar Domínio Customizado (Opcional)

### Quando Usar
- Recomendado para produção
- Melhora confiabilidade dos emails
- Remove limites de rate do SMTP interno

### Como Configurar

1. Vá em **Settings** → **Custom Domains** (disponível no plano Pro)
2. Adicione seu domínio: `seudominio.com`
3. Configure os registros DNS conforme instruído:
   ```
   Type: CNAME
   Name: supabase
   Value: xxxxx.supabase.co
   ```
4. Aguarde propagação DNS (~10 minutos a 24 horas)

---

## 7. Verificar Configurações de Segurança

### 7.1 Verificar RLS (Row Level Security)

1. Vá em **Authentication** → **Policies**
2. Verifique que as tabelas têm RLS habilitado:
   - ✅ `users` - RLS Enabled
   - ✅ `assinaturas` - RLS Enabled

### 7.2 Verificar Políticas

Clique em cada tabela e confirme as políticas:

**Tabela `users`**:
- ✅ "Users can view own profile" (SELECT)
- ✅ "Users can update own profile" (UPDATE)

**Tabela `assinaturas`**:
- ✅ "Users can view own subscription" (SELECT)
- ✅ "Service role can manage all subscriptions" (ALL)

### 7.3 Verificar Triggers

1. Vá em **Database** → **Triggers**
2. Confirme que existem:
   - ✅ `on_auth_user_created` na tabela `auth.users`
   - ✅ `update_users_updated_at` na tabela `users`
   - ✅ `update_assinaturas_updated_at` na tabela `assinaturas`

---

## 8. Testar o Fluxo de Autenticação

### 8.1 Teste de Cadastro

1. Inicie o app local: `npm run dev`
2. Acesse: `http://localhost:5173/cadastro`
3. Preencha o formulário:
   - Nome: "Teste Usuario"
   - Email: "teste@example.com"
   - Senha: "senha123"
   - Aceite os termos
4. Clique em **"Criar conta e começar teste"**

**Resultado esperado**:
- ✅ Toast de sucesso: "🎉 Bem-vindo! Você tem 7 dias grátis"
- ✅ Redirecionamento para `/app`
- ✅ Acesso ao dashboard

### 8.2 Verificar no Supabase

1. Vá em **Authentication** → **Users**
2. Você deve ver o novo usuário criado

3. Vá em **Table Editor** → **assinaturas**
4. Você deve ver um registro com:
   - `status`: "trial"
   - `trial_ends_at`: data/hora daqui 7 dias

### 8.3 Teste de Login

1. Faça logout
2. Acesse: `http://localhost:5173/login`
3. Faça login com as mesmas credenciais
4. Deve funcionar sem erros

### 8.4 Teste de Recuperação de Senha

1. Acesse: `http://localhost:5173/recuperar-senha`
2. Digite o email de teste
3. Clique em **"Enviar link de recuperação"**
4. Verifique:
   - ✅ Mensagem de sucesso aparece
   - ✅ Email chegou na caixa de entrada (pode levar 1-2 minutos)

⚠️ **NOTA**: Se confirmação de email estiver habilitada, você precisará confirmar o email antes de fazer login.

---

## 9. Deploy e Produção

### 9.1 Configurar Variáveis de Ambiente no Vercel

1. Acesse seu projeto no Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione as variáveis:

```
VITE_SUPABASE_URL = https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc...sua-anon-key-aqui...
VITE_USE_LOCAL_STORAGE = false
```

4. Clique em **Save**
5. Faça um novo deploy para aplicar as variáveis

### 9.2 Configurar URLs de Produção no Supabase

1. Volte ao Supabase → **Authentication** → **URL Configuration**
2. Atualize **Site URL** para sua URL de produção:
   ```
   https://seuapp.vercel.app
   ```

3. Adicione em **Redirect URLs**:
   ```
   https://seuapp.vercel.app/**
   https://seuapp.vercel.app/login
   https://seuapp.vercel.app/app
   ```

### 9.3 Habilitar Confirmação de Email

Para produção, é **altamente recomendado**:

1. Vá em **Authentication** → **Email**
2. Habilite **Confirm email**
3. Configure SMTP próprio (veja seção 5.4)

### 9.4 Configurar Job de Expiração de Trials

O sistema tem uma função `expire_trials()` que precisa ser executada diariamente. Opções:

**Opção A: Supabase Cron (Plano Pro)**

1. Vá em **Database** → **Cron Jobs**
2. Crie novo job:
   ```sql
   SELECT cron.schedule(
     'expire-trials-daily',
     '0 3 * * *', -- Todo dia às 3h da manhã
     $$ SELECT expire_trials(); $$
   );
   ```

**Opção B: Vercel Cron (Grátis)**

1. Crie uma API route em `/api/cron/expire-trials.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js'

   export default async function handler(req, res) {
     if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
       return res.status(401).json({ error: 'Unauthorized' })
     }

     const supabase = createClient(
       process.env.VITE_SUPABASE_URL!,
       process.env.SUPABASE_SERVICE_ROLE_KEY! // service_role para admin
     )

     const { data, error } = await supabase.rpc('expire_trials')

     if (error) {
       return res.status(500).json({ error: error.message })
     }

     return res.status(200).json({
       success: true,
       expired_count: data
     })
   }
   ```

2. Configure no `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/expire-trials",
       "schedule": "0 3 * * *"
     }]
   }
   ```

---

## ✅ Checklist Final

Antes de ir para produção, confirme:

- [ ] Projeto criado no Supabase
- [ ] Variáveis de ambiente configuradas (local e Vercel)
- [ ] Script SQL executado com sucesso
- [ ] Autenticação por email habilitada
- [ ] URLs de redirecionamento configuradas
- [ ] Templates de email personalizados
- [ ] SMTP próprio configurado (produção)
- [ ] RLS habilitado em todas as tabelas
- [ ] Políticas de segurança verificadas
- [ ] Triggers funcionando (verificar no teste de cadastro)
- [ ] Teste de cadastro funcionando
- [ ] Teste de login funcionando
- [ ] Teste de recuperação de senha funcionando
- [ ] Trial de 7 dias sendo criado automaticamente
- [ ] Deploy realizado com variáveis de ambiente
- [ ] Job de expiração de trials configurado

---

## 🆘 Troubleshooting

### Problema: "Invalid API key"

**Causa**: Variável de ambiente incorreta ou não carregada.

**Solução**:
1. Verifique se o arquivo `.env.local` existe
2. Confirme que as variáveis começam com `VITE_`
3. Reinicie o servidor: `npm run dev`

### Problema: "User already registered"

**Causa**: Tentativa de cadastro com email já existente.

**Solução**:
- Use outro email OU
- Delete o usuário no Supabase → **Authentication** → **Users**

### Problema: Email não está chegando

**Causa**: Limite de rate do SMTP interno (4 emails/hora).

**Solução**:
- Configure SMTP próprio (seção 5.4) OU
- Desabilite confirmação de email para testes

### Problema: "Row Level Security policy violation"

**Causa**: Política RLS bloqueando acesso.

**Solução**:
1. Verifique se o script SQL foi executado completamente
2. Confirme que as políticas existem em **Authentication** → **Policies**
3. Re-execute o script SQL se necessário

### Problema: Trial não está sendo criado

**Causa**: Trigger não está funcionando.

**Solução**:
1. Vá em **Database** → **Triggers**
2. Confirme que `on_auth_user_created` existe
3. Re-execute o script SQL se necessário
4. Tente criar um novo usuário

---

## 📚 Recursos Adicionais

- [Documentação oficial do Supabase](https://supabase.com/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [RLS Policies Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Community](https://github.com/supabase/supabase/discussions)

---

## 🎯 Próximos Passos

Após configurar o Supabase, você pode:

1. **Integrar pagamentos**: Adicionar Stripe/Asaas para assinaturas pagas
2. **Migrar dados**: Se tinha dados em localStorage, criar script de migração
3. **Adicionar analytics**: Configurar Posthog ou similar
4. **Implementar webhooks**: Para eventos de pagamento
5. **Criar testes**: E2E tests com Playwright/Cypress

---

**Última atualização**: Janeiro 2026
**Versão**: 1.0.0
