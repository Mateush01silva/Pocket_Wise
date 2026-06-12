-- =====================================================
-- Migration 079: Portadores de cartão + portador no lançamento
-- =====================================================
-- Permite cadastrar os portadores de um cartão (titular + adicionais) e
-- registrar, em cada lançamento de crédito, qual portador realizou a compra.
-- Adicionais NÃO são cartões separados: compartilham fatura e limite do
-- cartão principal, por isso ficam embutidos no próprio cartão (jsonb).
-- =====================================================

-- Lista de portadores do cartão: [{ "id": text, "nome": text }, ...]
ALTER TABLE cartoes
  ADD COLUMN IF NOT EXISTS portadores jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN cartoes.portadores IS
  'Portadores do cartão (titular + adicionais): [{ "id": text, "nome": text }]. Adicionais compartilham fatura/limite do cartão.';

-- Portador que realizou a compra (referência a um item de cartoes.portadores).
-- Sem FK pois os portadores ficam embutidos no jsonb do cartão.
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS portador_id text;

COMMENT ON COLUMN lancamentos.portador_id IS
  'ID do portador (em cartoes.portadores) que usou o cartão neste lançamento.';
