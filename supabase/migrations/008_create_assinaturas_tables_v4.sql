-- =====================================================
-- Migration: Create Assinaturas Tables (Versão 4 - Ultra Robusta)
-- Descrição: Criar tabelas para gerenciamento de assinaturas recorrentes
-- Data: 2026-01-19
-- Feature: #4 - Gestão de Assinaturas
-- Versão: 4.0 (sem dependências - adiciona colunas se não existirem)
-- =====================================================

-- =====================================================
-- STEP 1: Garantir que lancamentos tem categoria_id e subcategoria_id
-- =====================================================

DO $$
BEGIN
    -- Verificar e adicionar categoria_id em lancamentos se não existir
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
    ) THEN
        -- Adicionar categoria_id se não existir
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'lancamentos'
            AND column_name = 'categoria_id'
        ) THEN
            ALTER TABLE public.lancamentos ADD COLUMN categoria_id UUID;
            CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria_id ON public.lancamentos(categoria_id);
            RAISE NOTICE '✓ Coluna categoria_id adicionada à tabela lancamentos';
        ELSE
            RAISE NOTICE '✓ Coluna categoria_id já existe em lancamentos';
        END IF;

        -- Adicionar subcategoria_id se não existir
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'lancamentos'
            AND column_name = 'subcategoria_id'
        ) THEN
            ALTER TABLE public.lancamentos ADD COLUMN subcategoria_id UUID;
            CREATE INDEX IF NOT EXISTS idx_lancamentos_subcategoria_id ON public.lancamentos(subcategoria_id);
            RAISE NOTICE '✓ Coluna subcategoria_id adicionada à tabela lancamentos';
        ELSE
            RAISE NOTICE '✓ Coluna subcategoria_id já existe em lancamentos';
        END IF;

        -- Tentar adicionar foreign keys SE categorias existir
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'categorias'
        ) THEN
            -- FK para categoria_id (se não existir)
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name = 'lancamentos'
                AND constraint_name = 'fk_lancamentos_categoria'
            ) THEN
                ALTER TABLE public.lancamentos
                ADD CONSTRAINT fk_lancamentos_categoria
                FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
                RAISE NOTICE '✓ Foreign key categoria_id → categorias criada em lancamentos';
            END IF;

            -- FK para subcategoria_id (se não existir)
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name = 'lancamentos'
                AND constraint_name = 'fk_lancamentos_subcategoria'
            ) THEN
                ALTER TABLE public.lancamentos
                ADD CONSTRAINT fk_lancamentos_subcategoria
                FOREIGN KEY (subcategoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
                RAISE NOTICE '✓ Foreign key subcategoria_id → categorias criada em lancamentos';
            END IF;
        ELSE
            RAISE WARNING '⚠ Tabela categorias não existe. Foreign keys em lancamentos NÃO criadas.';
        END IF;
    ELSE
        RAISE WARNING '⚠ Tabela lancamentos não existe. Pulando configuração.';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Criar tabela de assinaturas (SEM foreign keys)
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
COMMENT ON COLUMN public.assinaturas.categoria_id IS 'Categoria da despesa';
COMMENT ON COLUMN public.assinaturas.subcategoria_id IS 'Subcategoria da despesa';

-- =====================================================
-- STEP 3: Adicionar Foreign Keys em assinaturas (CONDICIONAL)
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'categorias'
    ) THEN
        -- FK para categoria_id
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_name = 'assinaturas'
            AND constraint_name = 'fk_assinaturas_categoria'
        ) THEN
            ALTER TABLE public.assinaturas
            ADD CONSTRAINT fk_assinaturas_categoria
            FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
            RAISE NOTICE '✓ Foreign key categoria_id → categorias criada em assinaturas';
        END IF;

        -- FK para subcategoria_id
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_name = 'assinaturas'
            AND constraint_name = 'fk_assinaturas_subcategoria'
        ) THEN
            ALTER TABLE public.assinaturas
            ADD CONSTRAINT fk_assinaturas_subcategoria
            FOREIGN KEY (subcategoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;
            RAISE NOTICE '✓ Foreign key subcategoria_id → categorias criada em assinaturas';
        END IF;
    ELSE
        RAISE WARNING '⚠ Tabela categorias não existe. Foreign keys em assinaturas NÃO criadas.';
    END IF;
END $$;

-- =====================================================
-- STEP 4: Criar tabela de histórico de valores
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
-- STEP 5: Adicionar coluna assinatura_id em lancamentos
-- =====================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'lancamentos'
    ) THEN
        -- Adicionar coluna assinatura_id se não existir
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'lancamentos'
            AND column_name = 'assinatura_id'
        ) THEN
            ALTER TABLE public.lancamentos
            ADD COLUMN assinatura_id UUID;

            -- Criar foreign key
            ALTER TABLE public.lancamentos
            ADD CONSTRAINT fk_lancamentos_assinatura
            FOREIGN KEY (assinatura_id) REFERENCES public.assinaturas(id) ON DELETE SET NULL;

            CREATE INDEX IF NOT EXISTS idx_lancamentos_assinatura_id
                ON public.lancamentos(assinatura_id);

            COMMENT ON COLUMN public.lancamentos.assinatura_id IS 'Referência à assinatura que gerou este lançamento';

            RAISE NOTICE '✓ Coluna assinatura_id adicionada à tabela lancamentos';
        ELSE
            RAISE NOTICE '✓ Coluna assinatura_id já existe em lancamentos';
        END IF;
    ELSE
        RAISE WARNING '⚠ Tabela lancamentos não existe. Coluna assinatura_id NÃO foi adicionada.';
    END IF;
END $$;

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

DROP TRIGGER IF EXISTS set_assinaturas_updated_at ON public.assinaturas;
CREATE TRIGGER set_assinaturas_updated_at
    BEFORE UPDATE ON public.assinaturas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- STEP 7: Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_valor_assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas para assinaturas
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
-- STEP 8: Grants
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT SELECT, INSERT ON public.historico_valor_assinaturas TO authenticated;

-- =====================================================
-- STEP 9: Verificação Final
-- =====================================================

DO $$
DECLARE
    has_categorias BOOLEAN;
    has_lancamentos BOOLEAN;
    lancamentos_has_categoria_id BOOLEAN;
    lancamentos_has_subcategoria_id BOOLEAN;
    lancamentos_has_assinatura_id BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICAÇÃO FINAL DA MIGRATION';
    RAISE NOTICE '========================================';

    -- Verificar tabelas principais
    has_categorias := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categorias');
    has_lancamentos := EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lancamentos');

    IF has_lancamentos THEN
        lancamentos_has_categoria_id := EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'lancamentos' AND column_name = 'categoria_id'
        );
        lancamentos_has_subcategoria_id := EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'lancamentos' AND column_name = 'subcategoria_id'
        );
        lancamentos_has_assinatura_id := EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'lancamentos' AND column_name = 'assinatura_id'
        );
    END IF;

    -- Relatório
    RAISE NOTICE '';
    RAISE NOTICE '📋 Tabelas Existentes:';
    RAISE NOTICE '  ├─ categorias: %', CASE WHEN has_categorias THEN '✓' ELSE '✗' END;
    RAISE NOTICE '  ├─ lancamentos: %', CASE WHEN has_lancamentos THEN '✓' ELSE '✗' END;
    RAISE NOTICE '  ├─ assinaturas: ✓ (criada)';
    RAISE NOTICE '  └─ historico_valor_assinaturas: ✓ (criada)';
    RAISE NOTICE '';

    IF has_lancamentos THEN
        RAISE NOTICE '📋 Colunas em lancamentos:';
        RAISE NOTICE '  ├─ categoria_id: %', CASE WHEN lancamentos_has_categoria_id THEN '✓' ELSE '✗' END;
        RAISE NOTICE '  ├─ subcategoria_id: %', CASE WHEN lancamentos_has_subcategoria_id THEN '✓' ELSE '✗' END;
        RAISE NOTICE '  └─ assinatura_id: %', CASE WHEN lancamentos_has_assinatura_id THEN '✓' ELSE '✗' END;
        RAISE NOTICE '';
    END IF;

    IF NOT has_categorias THEN
        RAISE NOTICE '⚠️  ATENÇÃO: Tabela categorias não existe.';
        RAISE NOTICE '   Para criar, execute: 20250101000000_initial_schema.sql';
        RAISE NOTICE '';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '========================================';
END $$;
