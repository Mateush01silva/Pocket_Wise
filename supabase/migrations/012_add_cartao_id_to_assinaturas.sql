-- =====================================================
-- Migration: Adicionar cartao_id na tabela assinaturas
-- Descrição: Permite vincular assinaturas a cartões de crédito
-- Data: 2026-01-27
-- =====================================================

-- Adicionar coluna cartao_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'assinaturas'
        AND column_name = 'cartao_id'
    ) THEN
        -- Adicionar coluna
        ALTER TABLE public.assinaturas ADD COLUMN cartao_id UUID;

        -- Adicionar FK para cartoes (se a tabela existir)
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'cartoes'
        ) THEN
            ALTER TABLE public.assinaturas
            ADD CONSTRAINT fk_assinaturas_cartao
            FOREIGN KEY (cartao_id) REFERENCES public.cartoes(id) ON DELETE SET NULL;
            RAISE NOTICE '✓ Coluna cartao_id adicionada com FK para cartoes';
        ELSE
            RAISE NOTICE '✓ Coluna cartao_id adicionada (sem FK - tabela cartoes não existe)';
        END IF;
    ELSE
        RAISE NOTICE '✓ Coluna cartao_id já existe';
    END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_cartao_id ON public.assinaturas(cartao_id);

-- Verificação final
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION 012 CONCLUÍDA!';
    RAISE NOTICE 'Coluna cartao_id disponível em assinaturas';
    RAISE NOTICE '========================================';
END $$;
