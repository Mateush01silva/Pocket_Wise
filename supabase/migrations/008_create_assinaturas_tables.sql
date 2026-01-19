-- =====================================================
-- Migration: Create Assinaturas Tables
-- Descrição: Criar tabelas para gerenciamento de assinaturas recorrentes
-- Data: 2026-01-19
-- Feature: #4 - Gestão de Assinaturas
-- =====================================================

-- =====================================================
-- 1. Criar tabela de assinaturas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    logo_url TEXT,
    valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
    frequencia VARCHAR(20) NOT NULL CHECK (frequencia IN ('mensal', 'anual')),
    dia_cobranca INTEGER NOT NULL CHECK (dia_cobranca >= 1 AND dia_cobranca <= 31),
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    primeira_cobranca DATE NOT NULL,
    ultima_cobranca DATE,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Garantir que pelo menos um de user_id ou family_id está definido
    CONSTRAINT assinaturas_owner_check CHECK (
        user_id IS NOT NULL OR family_id IS NOT NULL
    )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id ON public.assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_family_id ON public.assinaturas(family_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_categoria_id ON public.assinaturas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_ativa ON public.assinaturas(ativa);
CREATE INDEX IF NOT EXISTS idx_assinaturas_primeira_cobranca ON public.assinaturas(primeira_cobranca);

-- Comentários
COMMENT ON TABLE public.assinaturas IS 'Assinaturas recorrentes (Netflix, Spotify, etc)';
COMMENT ON COLUMN public.assinaturas.frequencia IS 'Frequência de cobrança: mensal ou anual';
COMMENT ON COLUMN public.assinaturas.dia_cobranca IS 'Dia do mês da cobrança (1-31)';
COMMENT ON COLUMN public.assinaturas.primeira_cobranca IS 'Data da primeira cobrança da assinatura';
COMMENT ON COLUMN public.assinaturas.ultima_cobranca IS 'Data da última cobrança quando cancelada';
COMMENT ON COLUMN public.assinaturas.ativa IS 'Se a assinatura está ativa ou foi cancelada';

-- =====================================================
-- 2. Criar tabela de histórico de valores
-- =====================================================

CREATE TABLE IF NOT EXISTS public.historico_valor_assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assinatura_id UUID NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
    valor_antigo DECIMAL(10,2) NOT NULL,
    valor_novo DECIMAL(10,2) NOT NULL,
    vigencia_inicio DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_historico_valor_assinaturas_assinatura_id
    ON public.historico_valor_assinaturas(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_historico_valor_assinaturas_vigencia_inicio
    ON public.historico_valor_assinaturas(vigencia_inicio DESC);

-- Comentários
COMMENT ON TABLE public.historico_valor_assinaturas IS 'Histórico de alterações de valor das assinaturas';
COMMENT ON COLUMN public.historico_valor_assinaturas.vigencia_inicio IS 'Data a partir da qual o novo valor entra em vigor';

-- =====================================================
-- 3. Adicionar coluna assinatura_id na tabela lancamentos
-- =====================================================

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
        AND column_name = 'assinatura_id'
    ) THEN
        ALTER TABLE public.lancamentos
        ADD COLUMN assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL;

        -- Criar índice para performance
        CREATE INDEX idx_lancamentos_assinatura_id ON public.lancamentos(assinatura_id);

        -- Adicionar comentário
        COMMENT ON COLUMN public.lancamentos.assinatura_id IS 'ID da assinatura que gerou este lançamento (se aplicável)';
    END IF;
END $$;

-- =====================================================
-- 4. Trigger para atualizar updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_assinaturas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assinaturas_updated_at
    BEFORE UPDATE ON public.assinaturas
    FOR EACH ROW
    EXECUTE FUNCTION public.update_assinaturas_updated_at();

-- =====================================================
-- 5. Row Level Security (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_valor_assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas para assinaturas
-- Usuários podem ver suas próprias assinaturas ou assinaturas da família
CREATE POLICY "Users can view own assinaturas"
    ON public.assinaturas FOR SELECT
    USING (
        auth.uid() = user_id
        OR family_id IN (
            SELECT family_id FROM public.family_members
            WHERE user_id = auth.uid()
        )
    );

-- Usuários podem inserir assinaturas
CREATE POLICY "Users can insert own assinaturas"
    ON public.assinaturas FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR family_id IN (
            SELECT family_id FROM public.family_members
            WHERE user_id = auth.uid()
        )
    );

-- Usuários podem atualizar suas próprias assinaturas
CREATE POLICY "Users can update own assinaturas"
    ON public.assinaturas FOR UPDATE
    USING (
        auth.uid() = user_id
        OR family_id IN (
            SELECT family_id FROM public.family_members
            WHERE user_id = auth.uid()
        )
    );

-- Usuários podem deletar suas próprias assinaturas
CREATE POLICY "Users can delete own assinaturas"
    ON public.assinaturas FOR DELETE
    USING (
        auth.uid() = user_id
        OR family_id IN (
            SELECT family_id FROM public.family_members
            WHERE user_id = auth.uid()
        )
    );

-- Políticas para histórico de valores
-- Usuários podem ver histórico de suas assinaturas
CREATE POLICY "Users can view own historico_valor"
    ON public.historico_valor_assinaturas FOR SELECT
    USING (
        assinatura_id IN (
            SELECT id FROM public.assinaturas
            WHERE user_id = auth.uid()
            OR family_id IN (
                SELECT family_id FROM public.family_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- Usuários podem inserir histórico de suas assinaturas
CREATE POLICY "Users can insert own historico_valor"
    ON public.historico_valor_assinaturas FOR INSERT
    WITH CHECK (
        assinatura_id IN (
            SELECT id FROM public.assinaturas
            WHERE user_id = auth.uid()
            OR family_id IN (
                SELECT family_id FROM public.family_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- =====================================================
-- 6. Grants
-- =====================================================

-- Garantir permissões para authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT SELECT, INSERT ON public.historico_valor_assinaturas TO authenticated;
GRANT USAGE ON SEQUENCE assinaturas_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE historico_valor_assinaturas_id_seq TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 008: Assinaturas tables created successfully';
END $$;
