# Guia de Configuração - Asaas + Pocket Wise

Este guia contém todas as instruções para configurar a integração de pagamentos com a Asaas.

---

## Visão Geral

| Item | Detalhe |
|------|---------|
| **Plano Mensal** | R$ 12,90/mês |
| **Plano Anual** | R$ 119,90/ano (economia de R$ 34,90) |
| **Trial** | 7 dias grátis (já implementado) |
| **Gateway** | Asaas |
| **Backend** | Supabase Edge Functions |
| **Métodos aceitos** | Pix, Cartão de Crédito, Boleto |

---

## Passo 1: Configurar a conta Asaas

### 1.1 Obter chave da API

1. Acesse sua conta em [asaas.com](https://www.asaas.com) (ou [sandbox.asaas.com](https://sandbox.asaas.com) para testes)
2. Vá em **Minha Conta** → **Integrações** → **API**
3. Clique em **"Gerar nova chave de API"**
4. Copie o token gerado (começa com `$aact_...`)
5. **Guarde em local seguro** - você vai usar este token nas Edge Functions

> **IMPORTANTE**: Para desenvolvimento/testes, use o ambiente **Sandbox** da Asaas.
> Crie uma conta sandbox em: https://sandbox.asaas.com
> A chave de API do sandbox é diferente da produção.

### 1.2 Configurar Webhooks na Asaas

1. No painel da Asaas, vá em **Minha Conta** → **Integrações** → **Webhooks**
2. Clique em **"Adicionar webhook"**
3. Configure:
   - **URL**: `https://<seu-projeto>.supabase.co/functions/v1/asaas-webhook`
     - Substitua `<seu-projeto>` pelo ID do seu projeto Supabase
     - Exemplo: `https://ryqlnvtnlvriiuepheap.supabase.co/functions/v1/asaas-webhook`
   - **Versão da API**: v3
   - **Autenticação**: Se quiser uma camada extra de segurança, adicione um token personalizado
   - **Eventos para receber** (marque estes):
     - `PAYMENT_CONFIRMED` - Pagamento confirmado (boleto/pix)
     - `PAYMENT_RECEIVED` - Pagamento recebido (cartão)
     - `PAYMENT_OVERDUE` - Pagamento vencido
     - `PAYMENT_REFUNDED` - Pagamento estornado
     - `PAYMENT_DELETED` - Pagamento removido
     - `SUBSCRIPTION_DELETED` - Assinatura cancelada
4. Salve o webhook

### 1.3 Verificar dados da conta

Para receber pagamentos em produção, a Asaas exige:
- CPF/CNPJ verificado
- Dados bancários cadastrados
- Endereço completo
- Documentos de identidade (para contas PF)

---

## Passo 2: Configurar Supabase Edge Functions

### 2.1 Instalar CLI do Supabase (se ainda não instalou)

```bash
npm install -g supabase
```

### 2.2 Login e link do projeto

```bash
# Login no Supabase
supabase login

# Linkar ao projeto existente
supabase link --project-ref ryqlnvtnlvriiuepheap
```

### 2.3 Configurar Secrets (variáveis de ambiente das Edge Functions)

```bash
# Chave da API Asaas (obtenha no passo 1.1)
supabase secrets set ASAAS_API_KEY=$aact_SuaChaveAqui

# Ambiente: "sandbox" para testes, "production" para produção
supabase secrets set ASAAS_ENVIRONMENT=sandbox

# Token de webhook (opcional - use o mesmo configurado no passo 1.2)
supabase secrets set ASAAS_WEBHOOK_TOKEN=SeuTokenWebhookAqui
```

### 2.4 Deploy das Edge Functions

```bash
# Deploy da função de checkout
supabase functions deploy create-checkout --no-verify-jwt

# Deploy da função de webhook (sem JWT pois a Asaas chama diretamente)
supabase functions deploy asaas-webhook --no-verify-jwt
```

> **Nota sobre --no-verify-jwt**: A função `create-checkout` faz a verificação de JWT internamente
> (via `supabase.auth.getUser()`). A função `asaas-webhook` é chamada pela Asaas
> e não terá JWT do Supabase - ela usa o token de webhook para autenticação.

### 2.5 Testar as funções

```bash
# Verificar se as funções estão rodando
supabase functions list
```

---

## Passo 3: Executar a Migration do Banco

### 3.1 Executar no SQL Editor do Supabase

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Abra o arquivo `supabase/migrations/014_add_asaas_payment_fields.sql`
3. Copie todo o conteúdo e cole no SQL Editor
4. Clique em **Run**
5. Verifique a mensagem de sucesso

### 3.2 Verificar campos criados

Execute no SQL Editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assinaturas'
ORDER BY ordinal_position;
```

Deve mostrar os novos campos:
- `asaas_customer_id` (VARCHAR)
- `asaas_subscription_id` (VARCHAR)
- `asaas_payment_url` (TEXT)

E os campos Stripe antigos devem ter sido removidos.

---

## Passo 4: Testar o fluxo completo (Sandbox)

### 4.1 Teste de ponta a ponta

1. **Acesse o app** com um usuário cujo trial expirou (ou crie um novo)
2. **Clique em "Assinar Mensal"** ou **"Assinar Anual"** na Paywall
3. **Será redirecionado** para a página de pagamento da Asaas
4. **No sandbox**, use os dados de teste:
   - Cartão: `5162306219378829` (Mastercard teste)
   - Validade: qualquer data futura
   - CVV: `123`
   - CPF: `24971563792` (CPF de teste)
5. **Após o pagamento**, a Asaas enviará o webhook
6. **Verifique** no Supabase SQL Editor:

```sql
SELECT status, plan, asaas_customer_id, asaas_subscription_id
FROM assinaturas
WHERE user_id = 'ID_DO_USUARIO';
```

O status deve ser `active`.

### 4.2 Testar Pix no sandbox

No sandbox da Asaas, o Pix funciona automaticamente:
- A cobrança é criada com QR Code
- No sandbox, o pagamento é simulado automaticamente

### 4.3 Verificar logs das Edge Functions

```bash
# Ver logs em tempo real
supabase functions logs create-checkout
supabase functions logs asaas-webhook
```

---

## Passo 5: Ir para Produção

### 5.1 Checklist de produção

- [ ] Trocar conta Asaas de **sandbox** para **produção**
- [ ] Gerar nova chave de API na conta de **produção**
- [ ] Atualizar secrets do Supabase:
  ```bash
  supabase secrets set ASAAS_API_KEY=$aact_ChaveDeProducao
  supabase secrets set ASAAS_ENVIRONMENT=production
  ```
- [ ] Reconfigurar webhook na conta de **produção** da Asaas
- [ ] Re-deploy das Edge Functions:
  ```bash
  supabase functions deploy create-checkout --no-verify-jwt
  supabase functions deploy asaas-webhook --no-verify-jwt
  ```
- [ ] Testar com um pagamento real de baixo valor
- [ ] Verificar que o webhook está funcionando em produção

### 5.2 Monitoramento

- Acompanhe os pagamentos no **dashboard da Asaas**
- Verifique os logs das Edge Functions no **Supabase Dashboard → Edge Functions → Logs**
- Monitore a tabela `assinaturas` no banco para garantir atualizações corretas

---

## Estrutura dos arquivos criados

```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── asaas.ts           # Cliente da API Asaas (customers, subscriptions)
│   │   ├── cors.ts            # Headers CORS
│   │   └── supabase-admin.ts  # Cliente Supabase com service_role
│   ├── create-checkout/
│   │   └── index.ts           # Edge Function: cria cliente + assinatura na Asaas
│   └── asaas-webhook/
│       └── index.ts           # Edge Function: recebe webhooks da Asaas
├── migrations/
│   └── 014_add_asaas_payment_fields.sql  # Migration para campos Asaas
src/
├── services/
│   └── paymentService.ts      # Service do frontend para chamar Edge Functions
└── pages/
    └── Paywall.tsx             # UI atualizada com integração de pagamento
```

---

## Fluxo de pagamento resumido

```
1. Usuário clica "Assinar" na Paywall
2. Frontend chama supabase.functions.invoke('create-checkout')
3. Edge Function cria customer na Asaas (se não existe)
4. Edge Function cria subscription na Asaas (R$12,90 ou R$119,90)
5. Asaas retorna paymentLink
6. Usuário é redirecionado para pagar (Pix/Cartão/Boleto)
7. Após pagamento, Asaas envia webhook para asaas-webhook
8. Webhook atualiza status da assinatura para 'active' no Supabase
9. Usuário volta ao app e tem acesso completo
```

---

## Troubleshooting

### "Erro ao criar checkout"
- Verifique se as Edge Functions foram deployadas: `supabase functions list`
- Verifique os secrets: `supabase secrets list`
- Verifique os logs: `supabase functions logs create-checkout`

### Webhook não atualiza o status
- Verifique se a URL do webhook está correta na Asaas
- Verifique os logs: `supabase functions logs asaas-webhook`
- Verifique se o `externalReference` está sendo enviado (é o `user_id`)

### Pagamento confirmado mas status não muda
- O `externalReference` na Asaas precisa ser o `user_id` do Supabase
- Verifique se a migration foi executada (campos `asaas_*` existem)

### Erro de CORS
- As Edge Functions já têm CORS configurado para aceitar todas as origens
- Verifique se o deploy foi feito com `--no-verify-jwt`
