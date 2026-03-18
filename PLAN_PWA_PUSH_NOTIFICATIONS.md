# Plano: PWA Push Notifications — Pocket Wise

## Visão Geral

Implementar notificações push nativas para Android e iOS (PWA), aproveitando a infraestrutura Supabase existente. O objetivo é converter eventos que já existem in-app em notificações que chegam ao celular do usuário mesmo com o app fechado.

**Prioridade confirmada:** Financeiras críticas + trial conversion.
**Backend:** Supabase Edge Functions (Deno/TypeScript).

---

## Notificações a Implementar

### 🔴 Prioritárias (Phase 1 — esta entrega)

| # | Notificação | Gatilho | Rota alvo |
|---|-------------|---------|-----------|
| 1 | **Envelope estourado** | Usuário faz lançamento que estoura o envelope | `/app/envelopes` |
| 2 | **Despesas vencidas** | Cron diário — despesas pendentes com data no passado | `/app/transacoes?status=pendente` |
| 3 | **Cartão no limite** | Cron diário — fatura ≥ 90% do limite | `/app/cartoes` |
| 4 | **Trial expirando — 3 dias** | Cron diário — `trial_ends_at` em 3 dias | `/app/paywall` |
| 5 | **Trial expirando — 1 dia** | Cron diário — `trial_ends_at` em 1 dia | `/app/paywall` |
| 6 | **Trial expirado — reengajamento** | Cron diário — `trial_ends_at` há 1–2 dias | `/app/paywall` |

### 🟡 Fase 2 (após Phase 1 estável)

| # | Notificação | Gatilho |
|---|-------------|---------|
| 7 | **Hora de planejar o próximo mês** | Cron — 3 dias antes do fim do mês |
| 8 | **Mensagem proativa da IA** | Após `ai-proativo-diario` gerar mensagem |
| 9 | **Meta de caixinha atingida** | Trigger no `ai-proativo-diario` |
| 10 | **Resumo mensal** | Cron — dia 1 do mês |

### 💡 Ideias adicionais identificadas (backlog)

- **Fatura do cartão vencendo em 3 dias** — "Fatura do Nubank vence em 3 dias: R$ 850,00"
- **Gasto incomum detectado** — novo lançamento > 2× média da categoria
- **Caixinha atingiu milestone** — 50%, 75%, 100% da meta
- **Recobrar usuário inativo (sem AI)** — 7 dias sem lançamento → "Tudo bem com suas finanças?"
- **Check-in do novo mês** — dia 1, para usuários sem acesso à IA
- **Meta de poupança mensal atingida** — "Você economizou R$ X este mês!"
- **Primeiro mês fechado perfeito** — todos os envelopes no verde

---

## Arquitetura Técnica

### Web Push Protocol
```
Browser                Supabase DB            Edge Function
   |                       |                       |
   |--subscribe()--------->|                       |
   |  (endpoint+keys)      |                       |
   |                       |                       |
   |                       |<--cron/trigger--------|
   |                       |--push_subscription--->|
   |<--push notification---|<--VAPID signed push---|
```

### VAPID Keys
- Gerar uma vez: `npx web-push generate-vapid-keys`
- `VITE_VAPID_PUBLIC_KEY` → `.env` (exposta ao frontend)
- `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` → Supabase Vault (secrets)

### Service Worker Strategy
Trocar `vite-plugin-pwa` de **`generateSW`** (default) para **`injectManifest`**:
- Workbox injeta o manifest de precache no SW customizado
- O SW customizado adiciona handlers de `push` e `notificationclick`
- Arquivo: `public/sw.ts` (TypeScript, compilado para `dist/sw.js`)

---

## Arquivos a Criar/Modificar

### Novos arquivos
```
public/sw.ts                                        ← Service worker customizado
src/hooks/usePushNotifications.ts                   ← Hook React
src/components/PushPermissionBanner.tsx             ← Banner de permissão
supabase/migrations/046_push_notifications.sql      ← Tabelas push_subscriptions + prefs
supabase/functions/send-push/index.ts               ← Edge Function helper
supabase/functions/notify-daily-push/index.ts       ← Cron de alertas financeiros + trial
```

### Arquivos modificados
```
vite.config.ts                                      ← injectManifest + swSrc
src/pages/Settings.tsx                              ← Seção de notificações push
supabase/functions/ai-proativo-diario/index.ts      ← Enviar push após salvar msg (Phase 2)
```

---

## Banco de Dados

### `push_subscriptions`
```sql
CREATE TABLE push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns subscription" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
```

### `push_notification_preferences`
```sql
CREATE TABLE push_notification_preferences (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  envelope_burst boolean DEFAULT true,
  expense_overdue boolean DEFAULT true,
  credit_card_limit boolean DEFAULT true,
  trial_expiring boolean DEFAULT true,
  month_end_reminder boolean DEFAULT true,
  ai_proactive boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE push_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns prefs" ON push_notification_preferences
  FOR ALL USING (auth.uid() = user_id);
```

### `push_notification_log` (cooldown + dedup)
```sql
CREATE TABLE push_notification_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL,   -- ex: 'envelope_burst', 'trial_3d'
  ref_key text,                       -- ex: categoria_id, 'trial'
  sent_at timestamptz DEFAULT now()
);
CREATE INDEX ON push_notification_log (user_id, notification_type, sent_at);
```

---

## Edge Functions

### `send-push` (helper reutilizável)
- Recebe: `userId`, `title`, `body`, `url`, `tag`
- Busca subscriptions ativas do usuário
- Assina payload com VAPID (usa `npm:web-push` via esm.sh)
- Trata erros 410/404 → desativa subscription expirada

### `notify-daily-push` (cron: todo dia 8h BRT)
Verifica em paralelo para todos os usuários:
1. **Despesas vencidas** — pendentes com data passada → push se cooldown > 24h
2. **Cartão no limite** — ≥90% do limite → push se cooldown > 24h
3. **Trial expirando** — verifica `trial_ends_at` → 3d ou 1d → push (uma vez cada)
4. **Trial reengajamento** — `trial_ends_at` há 1–2 dias → push (uma vez)

---

## Frontend — Hook `usePushNotifications`

```typescript
const {
  isSupported,     // browser suporta Push API?
  isSubscribed,    // usuário já subscreveu?
  permission,      // 'default' | 'granted' | 'denied'
  subscribe,       // solicita permissão + salva no Supabase
  unsubscribe,     // remove subscription
  preferences,     // configurações por tipo
  updatePreference // atualiza uma preferência
} = usePushNotifications()
```

### Estratégia de solicitação de permissão
- **NÃO** pedir logo no primeiro login
- Mostrar banner sutil após:
  - 3ª visita ao app **OU**
  - Quando uma notificação urgente ocorre no sino (envelope estourado, despesa vencida)
- O banner explica o benefício antes de pedir permissão do browser
- Se o usuário recusar, não mostrar novamente por 30 dias

---

## iOS — Considerações Importantes

- Funciona somente no **iOS 16.4+**
- PWA deve estar instalada via "Adicionar à Tela de Início"
- Permissão deve ser solicitada dentro de um **gesto do usuário** (click)
- Ícone de notificação: usar PNG (não JPEG) — criar `public/notification-icon.png`
- Badge: usar `public/notification-badge.png` (72×72, monocromático)

---

## Fases de Implementação

### Phase 1 — Infrastructure + Financeiras críticas + Trial (esta entrega)

1. **[DB]** Migration `046_push_notifications.sql` — 3 tabelas acima
2. **[VAPID]** Gerar chaves, adicionar ao Supabase Vault + `.env`
3. **[SW]** `public/sw.ts` com handlers push + notificationclick
4. **[Config]** `vite.config.ts` → `injectManifest`, `swSrc: 'public/sw.ts'`
5. **[Hook]** `usePushNotifications.ts`
6. **[UI Banner]** `PushPermissionBanner.tsx` — trigger inteligente
7. **[Settings]** Seção "Notificações" na página Settings.tsx
8. **[Edge]** `send-push/index.ts` — helper reutilizável
9. **[Edge]** `notify-daily-push/index.ts` — cron para 5 tipos prioritários
10. **[Cron]** Configurar pg_cron para chamar `notify-daily-push` às 8h BRT

### Phase 2 — IA + Month-end (próxima entrega)

11. **[Edge]** Extend `ai-proativo-diario` → chamar `send-push` após salvar mensagem
12. **[Edge]** Lógica de "3 dias antes do fim do mês" em `notify-daily-push`
13. **[Edge]** Push na meta de caixinha atingida

---

## Cooldown / Anti-spam

| Tipo | Cooldown |
|------|----------|
| Envelope burst | 24h por envelope |
| Despesa vencida | 24h (única notificação consolidada) |
| Cartão no limite | 24h por cartão |
| Trial 3 dias | 1× por trial |
| Trial 1 dia | 1× por trial |
| Trial reengajamento | 1× por trial |
| Month-end reminder | 1× por mês |
| AI proativa | Herdado do cooldown 7d do `ai-proativo-diario` |
