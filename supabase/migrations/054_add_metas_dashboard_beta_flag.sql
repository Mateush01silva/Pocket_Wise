-- Migration: Adicionar flag metas_dashboard_beta à tabela ai_feature_access
-- Descrição: Controla acesso ao dashboard melhorado de Metas e Sonhos
-- Ativação: Manual pelo admin antes de liberar para usuários
-- Data: 2026-04-13

-- =====================================================
-- 1. NOVA COLUNA EM ai_feature_access
-- =====================================================

ALTER TABLE ai_feature_access
  ADD COLUMN IF NOT EXISTS metas_dashboard_beta BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- 2. COMENTÁRIO
-- =====================================================

COMMENT ON COLUMN ai_feature_access.metas_dashboard_beta IS
  'Habilita o dashboard melhorado de Metas e Sonhos (agrupamento por horizonte, badge de status, projeção, drag-to-reorder). Ativado manualmente pelo admin.';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
