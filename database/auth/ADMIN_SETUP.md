# 🔑 Configurar Acesso de Administrador

## Passo a Passo

### 1. Execute o script SQL no Supabase

1. Acesse o [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
2. Abra o arquivo `database/auth/002_admin_access.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor e clique em **RUN**

### 2. Torne seu email administrador

Ainda no SQL Editor, execute o seguinte comando **substituindo pelo seu email**:

```sql
SELECT make_user_admin('seu-email@exemplo.com');
```

Por exemplo, se seu email é `joao@gmail.com`:

```sql
SELECT make_user_admin('joao@gmail.com');
```

### 3. Pronto! 🎉

Agora você tem:
- ✅ Acesso ilimitado como administrador
- ✅ Sem necessidade de assinatura
- ✅ Pode testar o sistema sem limites de tempo

## Verificar se funcionou

Execute este comando para verificar:

```sql
SELECT id, email, role FROM users WHERE role = 'admin';
```

Você deve ver seu email na lista com `role = 'admin'`.

## Comandos Úteis

### Ver todos os admins
```sql
SELECT id, email, role, created_at FROM users WHERE role = 'admin';
```

### Remover admin de um usuário
```sql
UPDATE users SET role = 'user' WHERE email = 'email@exemplo.com';
```

### Ver status de assinatura
```sql
SELECT
  u.email,
  u.role,
  a.status,
  a.trial_ends_at,
  user_has_access(u.id) as has_access
FROM users u
LEFT JOIN assinaturas a ON a.user_id = u.id;
```
