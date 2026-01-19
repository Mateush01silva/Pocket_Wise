-- =====================================================
-- Script de Diagnóstico do Banco
-- Execute ANTES da migration de assinaturas
-- =====================================================

DO $$
DECLARE
    has_lancamentos BOOLEAN;
    has_categorias BOOLEAN;
    has_assinaturas BOOLEAN;
    lancamentos_cols TEXT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNÓSTICO DO BANCO DE DADOS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Verificar tabelas
    has_lancamentos := EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'lancamentos'
    );

    has_categorias := EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'categorias'
    );

    has_assinaturas := EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'assinaturas'
    );

    RAISE NOTICE '📋 TABELAS:';
    RAISE NOTICE '  lancamentos: %', CASE WHEN has_lancamentos THEN '✓ EXISTE' ELSE '✗ NÃO EXISTE' END;
    RAISE NOTICE '  categorias: %', CASE WHEN has_categorias THEN '✓ EXISTE' ELSE '✗ NÃO EXISTE' END;
    RAISE NOTICE '  assinaturas: %', CASE WHEN has_assinaturas THEN '✓ EXISTE' ELSE '✗ NÃO EXISTE' END;
    RAISE NOTICE '';

    -- Se lancamentos existe, mostrar colunas
    IF has_lancamentos THEN
        RAISE NOTICE '📋 COLUNAS EM lancamentos:';

        FOR lancamentos_cols IN
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'lancamentos'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  ├─ %', lancamentos_cols;
        END LOOP;
        RAISE NOTICE '';

        -- Verificar colunas específicas
        RAISE NOTICE '📋 COLUNAS CRÍTICAS:';
        RAISE NOTICE '  categoria_id: %',
            CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'lancamentos' AND column_name = 'categoria_id'
            ) THEN '✓ EXISTE' ELSE '✗ NÃO EXISTE' END;

        RAISE NOTICE '  subcategoria_id: %',
            CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'lancamentos' AND column_name = 'subcategoria_id'
            ) THEN '✓ EXISTE' ELSE '✗ NÃO EXISTE' END;

        RAISE NOTICE '  assinatura_id: %',
            CASE WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'lancamentos' AND column_name = 'assinatura_id'
            ) THEN '✓ EXISTE' ELSE '✗ NÃO EXISTE' END;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'FIM DO DIAGNÓSTICO';
    RAISE NOTICE '========================================';
END $$;
