-- Script para verificar dados dos envelopes e transações
-- Executar para diagnosticar problemas nos saldos

-- 1. Verificar orçamentos existentes
SELECT
  id,
  mes_referencia,
  created_at
FROM orcamentos_mensais
ORDER BY mes_referencia DESC
LIMIT 5;

-- 2. Verificar categorias budget do orçamento mais recente
SELECT
  cb.id,
  c.nome as categoria_nome,
  cb.valor_orcado,
  cb.prioridade
FROM categorias_budget cb
JOIN categorias c ON c.id = cb.categoria_id
WHERE cb.orcamento_id = (
  SELECT id FROM orcamentos_mensais
  ORDER BY mes_referencia DESC
  LIMIT 1
)
ORDER BY c.nome;

-- 3. Verificar lançamentos do mês mais recente (comparar com o orçamento)
WITH ultimo_orcamento AS (
  SELECT id, mes_referencia, SUBSTRING(mes_referencia, 1, 7) as ano_mes
  FROM orcamentos_mensais
  ORDER BY mes_referencia DESC
  LIMIT 1
)
SELECT
  l.id,
  l.descricao,
  l.valor,
  l.data,
  l.status,
  l.tipo,
  c.nome as categoria_nome,
  SUBSTRING(l.data, 1, 7) as lancamento_mes
FROM lancamentos l
LEFT JOIN categorias c ON c.id = l.categoria_id
WHERE SUBSTRING(l.data, 1, 7) = (SELECT ano_mes FROM ultimo_orcamento)
  AND l.tipo = 'despesa'
ORDER BY l.data DESC;

-- 4. Calcular saldo por categoria (como deveria aparecer nos envelopes)
WITH ultimo_orcamento AS (
  SELECT id, mes_referencia, SUBSTRING(mes_referencia, 1, 7) as ano_mes
  FROM orcamentos_mensais
  ORDER BY mes_referencia DESC
  LIMIT 1
)
SELECT
  c.nome as categoria,
  cb.valor_orcado,
  COALESCE(SUM(CASE WHEN l.status = 'pago' THEN l.valor ELSE 0 END), 0) as gasto_pago,
  COALESCE(SUM(CASE WHEN l.status = 'pendente' THEN l.valor ELSE 0 END), 0) as gasto_pendente,
  COALESCE(SUM(CASE WHEN l.status = 'projetado' THEN l.valor ELSE 0 END), 0) as gasto_projetado,
  COALESCE(SUM(l.valor), 0) as gasto_total,
  cb.valor_orcado - COALESCE(SUM(CASE WHEN l.status = 'pago' THEN l.valor ELSE 0 END), 0) as saldo_disponivel_atual,
  ROUND((COALESCE(SUM(CASE WHEN l.status = 'pago' THEN l.valor ELSE 0 END), 0) / cb.valor_orcado * 100)::numeric, 2) as percentual_usado
FROM categorias_budget cb
JOIN categorias c ON c.id = cb.categoria_id
LEFT JOIN lancamentos l ON l.categoria_id = cb.categoria_id
  AND l.tipo = 'despesa'
  AND SUBSTRING(l.data, 1, 7) = (SELECT ano_mes FROM ultimo_orcamento)
WHERE cb.orcamento_id = (SELECT id FROM ultimo_orcamento)
GROUP BY c.nome, cb.valor_orcado, cb.id
ORDER BY c.nome;

-- 5. Verificar se há transações sem categoria
WITH ultimo_orcamento AS (
  SELECT SUBSTRING(mes_referencia, 1, 7) as ano_mes
  FROM orcamentos_mensais
  ORDER BY mes_referencia DESC
  LIMIT 1
)
SELECT
  COUNT(*) as total_sem_categoria,
  SUM(valor) as valor_total_sem_categoria
FROM lancamentos
WHERE categoria_id IS NULL
  AND tipo = 'despesa'
  AND SUBSTRING(data, 1, 7) = (SELECT ano_mes FROM ultimo_orcamento);
