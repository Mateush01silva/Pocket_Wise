-- =====================================================
-- POCKET WISE - LIMPEZA DE ORÇAMENTOS
-- Script para remover tabelas e índices existentes
-- =====================================================
-- ⚠️ ATENÇÃO: Este script APAGA TODOS OS DADOS de orçamento!
-- Use apenas se quiser recriar tudo do zero.
-- =====================================================

-- Desabilitar RLS temporariamente
ALTER TABLE IF EXISTS patrimonio DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alertas_orcamento DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categorias_budget DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orcamentos_mensais DISABLE ROW LEVEL SECURITY;

-- Remover políticas RLS
DROP POLICY IF EXISTS "Usuários podem deletar próprio patrimônio" ON patrimonio;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio patrimônio" ON patrimonio;
DROP POLICY IF EXISTS "Usuários podem criar próprio patrimônio" ON patrimonio;
DROP POLICY IF EXISTS "Usuários podem ver próprio patrimônio" ON patrimonio;

DROP POLICY IF EXISTS "Usuários podem deletar alertas da própria família" ON alertas_orcamento;
DROP POLICY IF EXISTS "Usuários podem atualizar seus alertas" ON alertas_orcamento;
DROP POLICY IF EXISTS "Sistema pode criar alertas" ON alertas_orcamento;
DROP POLICY IF EXISTS "Usuários podem ver alertas da própria família" ON alertas_orcamento;

DROP POLICY IF EXISTS "Usuários podem deletar categorias_budget da própria família" ON categorias_budget;
DROP POLICY IF EXISTS "Usuários podem atualizar categorias_budget da própria família" ON categorias_budget;
DROP POLICY IF EXISTS "Usuários podem criar categorias_budget para sua família" ON categorias_budget;
DROP POLICY IF EXISTS "Usuários podem ver categorias_budget da própria família" ON categorias_budget;

DROP POLICY IF EXISTS "Usuários podem deletar orçamentos da própria família" ON orcamentos_mensais;
DROP POLICY IF EXISTS "Usuários podem atualizar orçamentos da própria família" ON orcamentos_mensais;
DROP POLICY IF EXISTS "Usuários podem criar orçamentos para sua família" ON orcamentos_mensais;
DROP POLICY IF EXISTS "Usuários podem ver orçamentos da própria família" ON orcamentos_mensais;

-- Remover triggers
DROP TRIGGER IF EXISTS trigger_update_categoria_budget_updated_at ON categorias_budget;
DROP TRIGGER IF EXISTS trigger_update_orcamento_updated_at ON orcamentos_mensais;

-- Remover função de trigger
DROP FUNCTION IF EXISTS update_orcamento_updated_at();

-- Remover tabelas (CASCADE remove dependências automaticamente)
DROP TABLE IF EXISTS patrimonio CASCADE;
DROP TABLE IF EXISTS alertas_orcamento CASCADE;
DROP TABLE IF EXISTS categorias_budget CASCADE;
DROP TABLE IF EXISTS orcamentos_mensais CASCADE;

-- Confirmação
DO $$
BEGIN
  RAISE NOTICE 'Limpeza concluída! Todas as tabelas de orçamento foram removidas.';
END $$;
