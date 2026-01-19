-- =====================================================
-- Migration: Create Assinaturas Tables (Versão Simplificada v3)
-- Descrição: Criar tabelas para gerenciamento de assinaturas recorrentes
-- Data: 2026-01-19
-- Feature: #4 - Gestão de Assinaturas
-- Versão: 3.0 (sem family_id + verificação condicional de categoria_id)
-- =====================================================

-- =====================================================
-- 1. Criar tabela de assinaturas (SEM foreign key para categoria_id)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    logo_url TEXT,
    valor DECIMAL(10,2) NOT NULL CHECK (valor > 0),
    frequencia VARCHAR(20) NOT NULL CHECK (frequencia IN ('mensal', 'anual')),
    dia_cobranca INTEGER NOT NULL CHECK (dia_cobranca >= 1 AND dia_cobranca <= 31),
    categoria_id UUID,  -- SEM foreign key constraint (será adicionado depois se categoria existir)
    subcategoria_id UUID,  -- SEM foreign key constraint
    primeira_cobranca DATE NOT NULL,
    ultima_cobranca DATE,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_user_id ON public.assinaturas(user_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_categoria_id ON public.assinaturas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_subcategoria_id ON public.assinaturas(subcategoria_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_ativa ON public.assinaturas(ativa);
CREATE INDEX IF NOT EXISTS idx_assinaturas_primeira_cobranca ON public.assinaturas(primeira_cobranca);

-- Comentários
COMMENT ON TABLE public.assinaturas IS 'Assinaturas recorrentes (Netflix, Spotify, etc)';
COMMENT ON COLUMN public.assinaturas.frequencia IS 'Frequência de cobrança: mensal ou anual';
COMMENT ON COLUMN public.assinaturas.dia_cobranca IS 'Dia do mês da cobrança (1-31)';
COMMENT ON COLUMN public.assinaturas.primeira_cobranca IS 'Data da primeira cobrança da assinatura';
COMMENT ON COLUMN public.assinaturas.ultima_cobranca IS 'Data da última cobrança quando cancelada';
COMMENT ON COLUMN public.assinaturas.ativa IS 'Se a assinatura está ativa ou foi cancelada';
COMMENT ON COLUMN public.assinaturas.categoria_id IS 'Categoria da despesa (FK será adicionado se categorias existir)';
COMMENT ON COLUMN public.assinaturas.subcategoria_id IS 'Subcategoria da despesa';

-- =====================================================
-- 2. Adicionar Foreign Keys CONDICIONALMENTE (se tabela categorias existir)
-- =====================================================

DO $$
BEGIN
    -- Verificar se a tabela categorias existe
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'categorias'
    ) THEN
        -- Adicionar FK para categoria_id
        ALTER TABLE public.assinaturas
        ADD CONSTRAINT fk_assinaturas_categoria
        FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;

        -- Adicionar FK para subcategoria_id
        ALTER TABLE public.assinaturas
        ADD CONSTRAINT fk_assinaturas_subcategoria
        FOREIGN KEY (subcategoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;

        RAISE NOTICE '✓ Foreign keys para categorias adicionadas';
    ELSE
        RAISE WARNING '⚠ Tabela categorias não existe. Foreign keys NÃO foram criadas.';
        RAISE WARNING '  Execute a migration inicial (20250101000000_initial_schema.sql) primeiro.';
    END IF;
END $$;

-- =====================================================
-- 3. Criar tabela de histórico de valores
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
    ON public.historico_valor_assinaturas(vigencia_inicio);

-- Comentários
COMMENT ON TABLE public.historico_valor_assinaturas IS 'Histórico de mudanças de valor das assinaturas';
COMMENT ON COLUMN public.historico_valor_assinaturas.vigencia_inicio IS 'Data de início da vigência do novo valor';

-- =====================================================
-- 4. Adicionar coluna assinatura_id na tabela lancamentos (CONDICIONAL)
-- =====================================================

DO $$
BEGIN
    -- Verificar se a tabela lancamentos existe
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
    ) THEN
        -- Verificar se a coluna já existe
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'lancamentos'
            AND column_name = 'assinatura_id'
        ) THEN
            ALTER TABLE public.lancamentos
            ADD COLUMN assinatura_id UUID REFERENCES public.assinaturas(id) ON DELETE SET NULL;

            CREATE INDEX IF NOT EXISTS idx_lancamentos_assinatura_id
                ON public.lancamentos(assinatura_id);

            COMMENT ON COLUMN public.lancamentos.assinatura_id IS 'Referência à assinatura que gerou este lançamento';

            RAISE NOTICE '✓ Coluna assinatura_id adicionada à tabela lancamentos';
        ELSE
            RAISE NOTICE '✓ Coluna assinatura_id já existe em lancamentos';
        END IF;
    ELSE
        RAISE WARNING '⚠ Tabela lancamentos não existe. Coluna assinatura_id NÃO foi adicionada.';
        RAISE WARNING '  Execute a migration inicial (20250101000000_initial_schema.sql) primeiro.';
    END IF;
END $$;

-- =====================================================
-- 5. Trigger para updated_at
-- =====================================================

-- Criar ou substituir função de trigger para updated_at (se não existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para assinaturas
DROP TRIGGER IF EXISTS set_assinaturas_updated_at ON public.assinaturas;
CREATE TRIGGER set_assinaturas_updated_at
    BEFORE UPDATE ON public.assinaturas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 6. Row Level Security (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_valor_assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas para assinaturas (somente user_id, sem family_id)
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

-- Políticas para histórico_valor_assinaturas
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
-- 7. Grants
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT SELECT, INSERT ON public.historico_valor_assinaturas TO authenticated;

-- =====================================================
-- 8. Verificação
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verificando tabelas criadas...';
    RAISE NOTICE '========================================';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assinaturas') THEN
        RAISE NOTICE '✓ Tabela assinaturas criada com sucesso';
    ELSE
        RAISE EXCEPTION '✗ Erro: Tabela assinaturas não foi criada';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'historico_valor_assinaturas') THEN
        RAISE NOTICE '✓ Tabela historico_valor_assinaturas criada com sucesso';
    ELSE
        RAISE EXCEPTION '✗ Erro: Tabela historico_valor_assinaturas não foi criada';
    END IF;

    -- Verificar se lancamentos existe e tem assinatura_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lancamentos') THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'lancamentos' AND column_name = 'assinatura_id'
        ) THEN
            RAISE NOTICE '✓ Coluna assinatura_id presente na tabela lancamentos';
        ELSE
            RAISE WARNING '⚠ Coluna assinatura_id NÃO foi adicionada à tabela lancamentos';
        END IF;
    ELSE
        RAISE WARNING '⚠ Tabela lancamentos não existe';
    END IF;

    -- Verificar se categorias existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias') THEN
        RAISE NOTICE '✓ Tabela categorias existe - Foreign keys criadas';
    ELSE
        RAISE WARNING '⚠ Tabela categorias não existe - Foreign keys NÃO foram criadas';
        RAISE WARNING '  Para adicionar foreign keys, execute:';
        RAISE WARNING '  1. Migration inicial: 20250101000000_initial_schema.sql';
        RAISE WARNING '  2. Depois rode: ALTER TABLE assinaturas ADD CONSTRAINT fk_assinaturas_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id);';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration concluída!';
    RAISE NOTICE '========================================';
END $$;
