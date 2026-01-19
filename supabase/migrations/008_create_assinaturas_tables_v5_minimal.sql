-- =====================================================
-- Migration: Preparar Banco para Assinaturas (Minimal)
-- Descrição: Adiciona colunas necessárias ANTES de criar assinaturas
-- Data: 2026-01-19
-- Versão: 5.0 (Minimal - Super Segura)
-- =====================================================

-- =====================================================
-- PARTE 1: APENAS adicionar colunas em lancamentos
-- =====================================================

-- Adicionar categoria_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
        AND column_name = 'categoria_id'
    ) THEN
        ALTER TABLE public.lancamentos ADD COLUMN categoria_id UUID;
        RAISE NOTICE '✓ Coluna categoria_id adicionada';
    ELSE
        RAISE NOTICE '✓ Coluna categoria_id já existe';
    END IF;
END $$;

-- Adicionar subcategoria_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
        AND column_name = 'subcategoria_id'
    ) THEN
        ALTER TABLE public.lancamentos ADD COLUMN subcategoria_id UUID;
        RAISE NOTICE '✓ Coluna subcategoria_id adicionada';
    ELSE
        RAISE NOTICE '✓ Coluna subcategoria_id já existe';
    END IF;
END $$;

-- =====================================================
-- PARTE 2: Criar tabela assinaturas (SIMPLES)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    logo_url TEXT,
    valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
    frequencia VARCHAR(20) NOT NULL CHECK (frequencia IN ('mensal', 'anual')),
    dia_cobranca INTEGER NOT NULL CHECK (dia_cobranca >= 1 AND dia_cobranca <= 31),
    categoria_id UUID,
    subcategoria_id UUID,
    primeira_cobranca DATE NOT NULL,
    ultima_cobranca DATE,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id ON public.assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_ativa ON public.assinaturas(ativa);

-- =====================================================
-- PARTE 3: Criar tabela histórico
-- =====================================================

CREATE TABLE IF NOT EXISTS public.historico_valor_assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
    valor_antigo DECIMAL(10,2) NOT NULL,
    valor_novo DECIMAL(10,2) NOT NULL,
    vigencia_inicio DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_valor_assinaturas_assinatura_id
    ON public.historico_valor_assinaturas(assinatura_id);

-- =====================================================
-- PARTE 4: Adicionar assinatura_id em lancamentos
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
        AND column_name = 'assinatura_id'
    ) THEN
        ALTER TABLE public.lancamentos ADD COLUMN assinatura_id UUID;

        -- Adicionar FK
        ALTER TABLE public.lancamentos
        ADD CONSTRAINT fk_lancamentos_assinatura
        FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id) ON DELETE SET NULL;

        RAISE NOTICE '✓ Coluna assinatura_id adicionada';
    ELSE
        RAISE NOTICE '✓ Coluna assinatura_id já existe';
    END IF;
END $$;

-- =====================================================
-- PARTE 5: RLS Policies
-- =====================================================

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_valor_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own assinaturas" ON public.assinaturas;
CREATE POLICY "Users can view their own assinaturas"
    ON public.assinaturas FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own assinaturas" ON public.assinaturas;
CREATE POLICY "Users can create their own assinaturas"
    ON public.assinaturas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own assinaturas" ON public.assinaturas;
CREATE POLICY "Users can update their own assinaturas"
    ON public.assinaturas FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own assinaturas" ON public.assinaturas;
CREATE POLICY "Users can delete their own assinaturas"
    ON public.assinaturas FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view historico of their own assinaturas" ON public.historico_valor_assinaturas;
CREATE POLICY "Users can view historico of their own assinaturas"
    ON public.historico_valor_assinaturas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assinaturas
            WHERE assinaturas.id = historico_valor_assinaturas.assinatura_id
            AND assinaturas.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create historico for their own assinaturas" ON public.historico_valor_assinaturas;
CREATE POLICY "Users can create historico for their own assinaturas"
    ON public.historico_valor_assinaturas FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assinaturas
            WHERE assinaturas.id = historico_valor_assinaturas.assinatura_id
            AND assinaturas.user_id = auth.uid()
        )
    );

-- =====================================================
-- PARTE 6: Grants
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT SELECT, INSERT ON public.historico_valor_assinaturas TO authenticated;

-- =====================================================
-- PARTE 7: Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_assinaturas_updated_at ON public.assinaturas;
CREATE TRIGGER set_assinaturas_updated_at
    BEFORE UPDATE ON public.assinaturas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Verificação final
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION CONCLUÍDA!';
    RAISE NOTICE '========================================';
END $$;
