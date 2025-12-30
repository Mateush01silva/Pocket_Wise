# 🚀 Guia de Deploy na Vercel

Este guia mostra como fazer o deploy do PocketWise na Vercel.

## 📋 Pré-requisitos

- ✅ Conta na Vercel (você já tem!)
- ✅ Conta GitHub conectada à Vercel (você já tem!)
- ✅ Repositório PocketWise no GitHub

## 🎯 Passo a Passo para Deploy

### 1. Acessar a Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Você verá o dashboard da Vercel

### 2. Importar o Projeto

1. Clique no botão **"Add New..."** (canto superior direito)
2. Selecione **"Project"**
3. Você verá uma lista dos seus repositórios do GitHub
4. Procure por **"Pocket_Wise"** na lista
5. Clique em **"Import"** ao lado do repositório

### 3. Configurar o Projeto

Na tela de configuração:

#### Build & Development Settings

A Vercel deve detectar automaticamente que é um projeto Vite. Confirme se está assim:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

✅ Se estiver tudo certo, não precisa mudar nada!

#### Environment Variables (Variáveis de Ambiente)

**IMPORTANTE**: Clique em "Environment Variables" e adicione:

```
VITE_USE_LOCAL_STORAGE = true
```

> 💡 **Por enquanto**: Estamos usando LocalStorage (modo MVP), então só precisamos dessa variável.
>
> **Futuramente**: Quando configurar o Supabase, você vai adicionar também:
> - `VITE_SUPABASE_URL`
> - `VITE_SUPABASE_ANON_KEY`

### 4. Fazer o Deploy

1. Clique no botão **"Deploy"** (azul, no final da página)
2. Aguarde alguns minutos enquanto a Vercel:
   - Clona seu repositório
   - Instala as dependências
   - Roda o build
   - Faz o deploy
3. 🎉 Quando concluir, você verá uma tela de celebração com confetes!

### 5. Acessar seu Site

1. Clique em **"Visit"** ou copie o link que aparece
2. Seu projeto estará no ar em um endereço tipo:
   ```
   https://pocket-wise-xxxx.vercel.app
   ```
3. Você pode personalizar esse domínio nas configurações depois!

---

## 🔄 Atualizações Automáticas

**Boa notícia**: A partir de agora, toda vez que você fizer um `git push` para o GitHub:
- A Vercel detecta automaticamente
- Faz o build e deploy da nova versão
- Seu site é atualizado em poucos minutos!

Você pode acompanhar os deploys em: `https://vercel.com/seu-usuario/pocket-wise`

---

## ⚙️ Configurações Adicionais (Opcional)

### Personalizar Domínio

1. No dashboard do projeto na Vercel
2. Vá em **Settings** → **Domains**
3. Adicione um domínio personalizado (se tiver)

### Variáveis de Ambiente por Ambiente

Você pode ter variáveis diferentes para:
- **Production**: O site principal (main branch)
- **Preview**: Pull requests e outras branches
- **Development**: Para testes locais

### Proteção de Branch

1. Em **Settings** → **Git**
2. Configure a branch de produção (geralmente `main`)

---

## 🐛 Troubleshooting

### Erro: "Build failed"

1. Vá em **Deployments** no dashboard
2. Clique no deploy que falhou
3. Veja os logs de erro
4. Geralmente é falta de variável de ambiente ou erro de build

**Solução comum**: Adicione `VITE_USE_LOCAL_STORAGE=true` nas variáveis de ambiente

### Site carrega em branco

1. Verifique o console do navegador (F12)
2. Provavelmente falta uma variável de ambiente
3. Adicione `VITE_USE_LOCAL_STORAGE=true` se ainda não tiver

### Deploy muito lento

- Normal na primeira vez (pode levar 3-5 minutos)
- Próximos deploys são mais rápidos (1-2 minutos)

---

## 📊 Monitoramento

### Ver Logs de Deploy

1. Vá em **Deployments**
2. Clique em qualquer deploy
3. Veja os logs detalhados (Build, Runtime, etc)

### Analytics (Opcional)

A Vercel oferece analytics gratuitos:
1. **Settings** → **Analytics**
2. Enable analytics
3. Veja visitantes, performance, etc

---

## 🔐 Quando Adicionar Supabase

Quando você configurar o Supabase, volte aqui e:

1. Vá em **Settings** → **Environment Variables**
2. Clique em **Add**
3. Adicione:
   ```
   VITE_SUPABASE_URL = sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY = sua_chave_publicavel
   VITE_USE_LOCAL_STORAGE = false
   ```
4. Clique em **Save**
5. Vá em **Deployments** e clique em **Redeploy** no último deploy

O site será reconstruído com as novas variáveis!

---

## 🎨 Dicas Úteis

### 1. Preview Deployments

Toda branch/PR gera um preview único:
- URL temporária para testar
- Não afeta o site principal
- Ideal para mostrar para outras pessoas antes de ir pra produção

### 2. Rollback Instantâneo

Se algo der errado:
1. Vá em **Deployments**
2. Encontre um deploy anterior que funcionava
3. Clique nos 3 pontinhos → **Promote to Production**
4. Volta para a versão anterior em segundos!

### 3. Vercel CLI (Opcional)

Para fazer deploy pelo terminal:
```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## 📱 Próximos Passos

Depois do deploy:

1. ✅ Teste todas as páginas
2. ✅ Abra no celular (é responsivo!)
3. ✅ Compartilhe o link com quem quiser
4. ✅ Continue desenvolvendo - cada push atualiza o site!

---

**Dúvidas?**
- Documentação oficial: [vercel.com/docs](https://vercel.com/docs)
- Suporte: [vercel.com/support](https://vercel.com/support)

**Boa sorte com o deploy!** 🚀
