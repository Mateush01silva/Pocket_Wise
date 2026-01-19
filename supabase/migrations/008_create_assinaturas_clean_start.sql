-- =====================================================
-- Migration: Assinaturas - Clean Start
-- Descrição: Limpa estado anterior e cria tudo do zero
-- Data: 2026-01-19
-- Versão: CLEAN START
-- =====================================================

-- =====================================================
-- STEP 1: Limpar estado anterior (se existir)
-- =====================================================

-- Dropar tabelas antigas (CASCADE para dropar dependências)
DROP TABLE IF EXISTS public.historico_valor_assinaturas CASCADE;
DROP TABLE IF EXISTS public.assinaturas CASCADE;

-- Remover coluna assinatura_id de lancamentos (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lancamentos' AND column_name = 'assinatura_id'
    ) THEN
        ALTER TABLE public.lancamentos DROP COLUMN assinatura_id CASCADE;
    END IF;
END $$;

-- =====================================================
-- STEP 2: Adicionar colunas em lancamentos (se não existir)
-- =====================================================

-- categoria_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lancamentos' AND column_name = 'categoria_id'
    ) THEN
        ALTER TABLE public.lancamentos ADD COLUMN categoria_id UUID;
    END IF;
END $$;

-- subcategoria_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lancamentos' AND column_name = 'subcategoria_id'
    ) THEN
        ALTER TABLE public.lancamentos ADD COLUMN subcategoria_id UUID;
    END IF;
END $$;

-- =====================================================
-- STEP 3: Criar tabela assinaturas (limpa)
-- =====================================================

CREATE TABLE public.assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX idx_assinaturas_user_id ON public.assinaturas(user_id);
CREATE INDEX idx_assinaturas_ativa ON public.assinaturas(ativa);
CREATE INDEX idx_assinaturas_categoria_id ON public.assinaturas(categoria_id);

-- =====================================================
-- STEP 4: Criar tabela historico_valor_assinaturas
-- =====================================================

CREATE TABLE public.historico_valor_assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
    valor_antigo DECIMAL(10,2) NOT NULL,
    valor_novo DECIMAL(10,2) NOT NULL,
    vigencia_inicio DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historico_valor_assinaturas_assinatura_id
    ON public.historico_valor_assinaturas(assinatura_id);

-- =====================================================
-- STEP 5: Adicionar assinatura_id em lancamentos
-- =====================================================

ALTER TABLE public.lancamentos ADD COLUMN assinatura_id UUID;

ALTER TABLE public.lancamentos
ADD CONSTRAINT fk_lancamentos_assinatura
FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id) ON DELETE SET NULL;

CREATE INDEX idx_lancamentos_assinatura_id ON public.lancamentos(assinatura_id);

-- =====================================================
-- STEP 6: Trigger para updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_assinaturas_updated_at
    BEFORE UPDATE ON public.assinaturas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- STEP 7: RLS Policies
-- =====================================================

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_valor_assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assinaturas"
    ON public.assinaturas FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assinaturas"
    ON public.assinaturas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assinaturas"
    ON public.assinaturas FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assinaturas"
    ON public.assinaturas FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view historico of their own assinaturas"
    ON public.historico_valor_assinaturas FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assinaturas
            WHERE assinaturas.id = historico_valor_assinaturas.assinatura_id
            AND assinaturas.user_id = auth.uid()
        )
    );

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
-- STEP 8: Grants
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT SELECT, INSERT ON public.historico_valor_assinaturas TO authenticated;

-- =====================================================
-- Verificação (retorna resultado visível)
-- =====================================================

SELECT 'Tabelas criadas com sucesso!' as status,
       COUNT(*) as total_assinaturas
FROM public.assinaturas;
