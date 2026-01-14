-- ============================================================================
-- MIGRAÇÃO: Converter nomes de ícones em inglês para emojis reais
-- ============================================================================
-- Descrição: Corrige ícones salvos como texto (ex: "utensils", "car")
--            para emojis Unicode reais (ex: "🍴", "🚗")
-- Data: 2026-01-14
-- ============================================================================

-- Categorias de DESPESA mais comuns
UPDATE categorias SET icone = '🍴' WHERE icone = 'utensils' OR icone = 'fork-knife' OR icone ILIKE '%alimenta%';
UPDATE categorias SET icone = '🚗' WHERE icone = 'car' OR icone = 'vehicle' OR icone ILIKE '%transport%';
UPDATE categorias SET icone = '🏠' WHERE icone = 'home' OR icone = 'house' OR icone ILIKE '%moradia%' OR icone ILIKE '%casa%';
UPDATE categorias SET icone = '❤️' WHERE icone = 'heart' OR icone = 'health' OR icone ILIKE '%saude%' OR icone ILIKE '%saúde%';
UPDATE categorias SET icone = '😊' WHERE icone = 'smile' OR icone = 'happy' OR icone ILIKE '%lazer%';
UPDATE categorias SET icone = '📚' WHERE icone = 'book' OR icone = 'books' OR icone ILIKE '%educa%';
UPDATE categorias SET icone = '👕' WHERE icone = 'shirt' OR icone = 'clothes' OR icone ILIKE '%roupa%' OR icone ILIKE '%vestuário%';
UPDATE categorias SET icone = '💡' WHERE icone = 'lightbulb' OR icone = 'light' OR icone ILIKE '%energia%' OR icone ILIKE '%luz%';
UPDATE categorias SET icone = '💳' WHERE icone = 'credit-card' OR icone = 'card' OR icone ILIKE '%cartao%' OR icone ILIKE '%cartão%';
UPDATE categorias SET icone = '🎮' WHERE icone = 'game' OR icone = 'gaming' OR icone ILIKE '%jogo%';
UPDATE categorias SET icone = '✈️' WHERE icone = 'plane' OR icone = 'airplane' OR icone ILIKE '%viagem%';
UPDATE categorias SET icone = '📱' WHERE icone = 'phone' OR icone = 'mobile' OR icone ILIKE '%celular%' OR icone ILIKE '%telefone%';
UPDATE categorias SET icone = '🐶' WHERE icone = 'dog' OR icone = 'pet' OR icone ILIKE '%pet%' OR icone ILIKE '%animal%';
UPDATE categorias SET icone = '💊' WHERE icone = 'pill' OR icone = 'medicine' OR icone ILIKE '%remedio%' OR icone ILIKE '%farmácia%';
UPDATE categorias SET icone = '🎓' WHERE icone = 'graduation-cap' OR icone = 'education' OR icone ILIKE '%curso%';
UPDATE categorias SET icone = '🏋️' WHERE icone = 'dumbbell' OR icone = 'gym' OR icone ILIKE '%academia%';
UPDATE categorias SET icone = '🎬' WHERE icone = 'movie' OR icone = 'film' OR icone ILIKE '%cinema%' OR icone ILIKE '%filme%';
UPDATE categorias SET icone = '🎵' WHERE icone = 'music' OR icone = 'note' OR icone ILIKE '%musica%' OR icone ILIKE '%música%';
UPDATE categorias SET icone = '🛒' WHERE icone = 'shopping-cart' OR icone = 'cart' OR icone ILIKE '%mercado%';
UPDATE categorias SET icone = '🔧' WHERE icone = 'wrench' OR icone = 'tool' OR icone ILIKE '%manutencao%' OR icone ILIKE '%manutenção%';

-- Categorias de RECEITA mais comuns
UPDATE categorias SET icone = '💰' WHERE icone = 'money-bag' OR icone = 'bag' OR icone ILIKE '%salario%' OR icone ILIKE '%salário%';
UPDATE categorias SET icone = '💵' WHERE icone = 'dollar' OR icone = 'money' OR icone ILIKE '%freelance%' OR icone ILIKE '%extra%';
UPDATE categorias SET icone = '🎁' WHERE icone = 'gift' OR icone = 'present' OR icone ILIKE '%presente%' OR icone ILIKE '%bonus%' OR icone ILIKE '%bônus%';
UPDATE categorias SET icone = '📈' WHERE icone = 'chart' OR icone = 'trending' OR icone ILIKE '%investimento%';
UPDATE categorias SET icone = '🏆' WHERE icone = 'trophy' OR icone = 'award' OR icone ILIKE '%premio%' OR icone ILIKE '%prêmio%';

-- Ícone padrão para qualquer outro texto em inglês comum
UPDATE categorias SET icone = '📦' WHERE icone ~ '^[a-zA-Z\-]+$' AND LENGTH(icone) > 2;

-- Verificar se ficou algum ícone em texto (útil para debug)
-- SELECT id, nome, icone FROM categorias WHERE icone ~ '^[a-zA-Z\-]+$';

-- Log de resultado
DO $$
DECLARE
    total_categorias INTEGER;
    categorias_com_emoji INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_categorias FROM categorias;
    SELECT COUNT(*) INTO categorias_com_emoji FROM categorias WHERE icone !~ '^[a-zA-Z\-]+$';

    RAISE NOTICE '✅ Migração de ícones concluída!';
    RAISE NOTICE 'Total de categorias: %', total_categorias;
    RAISE NOTICE 'Categorias com emoji: %', categorias_com_emoji;
    RAISE NOTICE 'Categorias ainda com texto: %', total_categorias - categorias_com_emoji;
END $$;
