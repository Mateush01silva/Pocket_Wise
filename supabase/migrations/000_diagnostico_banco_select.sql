-- =====================================================
-- Diagnóstico do Banco (usando SELECT - funciona no Supabase)
-- =====================================================

-- Ver todas as tabelas
SELECT
    'Tabelas existentes' as tipo,
    table_name as nome
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('lancamentos', 'categorias', 'assinaturas', 'historico_valor_assinaturas')
ORDER BY table_name;

-- Ver colunas da tabela lancamentos
SELECT
    'Colunas em lancamentos' as tipo,
    column_name as nome,
    data_type as tipo_dados,
    is_nullable as permite_null
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'lancamentos'
ORDER BY ordinal_position;

-- Ver colunas da tabela assinaturas (se existir)
SELECT
    'Colunas em assinaturas' as tipo,
    column_name as nome,
    data_type as tipo_dados,
    is_nullable as permite_null
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'assinaturas'
ORDER BY ordinal_position;
