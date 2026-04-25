-- ============================================================================
-- MIGRATION 063: Adicionar family_id em assinaturas para suporte a consultores
-- ============================================================================
-- Assinaturas eram user-scoped (user_id). Consultores precisam ver as
-- assinaturas do cliente. Esta migration adiciona family_id, faz backfill
-- e atualiza o RLS para permitir leitura por membros da família ativa.
-- ============================================================================

-- 1. Adicionar coluna family_id se não existir
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

-- 2. Backfill: usar personal_family_id do dono (família principal do usuário)
UPDATE public.assinaturas a
SET family_id = u.personal_family_id
FROM public.users u
WHERE a.user_id = u.id
  AND a.family_id IS NULL
  AND u.personal_family_id IS NOT NULL;

-- 3. Fallback: usar family_id ativo do usuário (para contas sem personal_family_id)
UPDATE public.assinaturas a
SET family_id = u.family_id
FROM public.users u
WHERE a.user_id = u.id
  AND a.family_id IS NULL
  AND u.family_id IS NOT NULL;

-- 4. Índice para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_family_id ON public.assinaturas(family_id);

-- 5. Remover políticas antigas de SELECT (criadas por diferentes versões da migration 008)
DROP POLICY IF EXISTS "Users can view their own assinaturas"          ON public.assinaturas;
DROP POLICY IF EXISTS "Users can view own assinaturas"                ON public.assinaturas;

-- 6. Nova política: membros da família ativa podem ler (inclui consultores)
CREATE POLICY "Family members can view assinaturas"
  ON public.assinaturas FOR SELECT
  USING (
    -- Família ativa do usuário autenticado (funciona para consultores que trocaram de família)
    family_id IN (
      SELECT family_id FROM public.users WHERE id = auth.uid()
    )
    -- Backward compat: registros antigos sem family_id acessados pelo próprio dono
    OR (family_id IS NULL AND user_id = auth.uid())
  );

-- 7. Repetir para historico_valor_assinaturas
DROP POLICY IF EXISTS "Users can view historico of their own assinaturas"   ON public.historico_valor_assinaturas;
DROP POLICY IF EXISTS "Users can view historico for their own assinaturas"  ON public.historico_valor_assinaturas;

CREATE POLICY "Family members can view historico assinaturas"
  ON public.historico_valor_assinaturas FOR SELECT
  USING (
    assinatura_id IN (
      SELECT id FROM public.assinaturas
      WHERE family_id IN (
        SELECT family_id FROM public.users WHERE id = auth.uid()
      )
      OR (family_id IS NULL AND user_id = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIM DA MIGRATION 063
-- ============================================================================
