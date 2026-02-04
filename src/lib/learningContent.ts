import type { LearningContent } from '../components/ui/LearningTooltip'

// =============================================
// CARDS DA DASHBOARD
// =============================================

export const learningContent = {
  // Dashboard Cards
  receitas: {
    titulo: 'Receitas',
    descricao: 'Representa todo o dinheiro que entra no seu orçamento durante o período selecionado. Inclui salário, freelances, vendas, rendimentos de investimentos, e qualquer outra fonte de renda.',
    comoFunciona: 'O sistema soma todas as transações marcadas como "receita" no período filtrado, independente de já terem sido recebidas ou ainda estarem pendentes.',
    comoCalculado: 'Soma de todas as transações do tipo "receita" no período selecionado (pagas + pendentes)',
    exemplo: 'Se você recebe R$ 5.000 de salário, R$ 800 de freelance e R$ 200 de cashback, suas receitas totais são R$ 6.000.',
    porqueImportante: 'Saber exatamente quanto você ganha é o primeiro passo para um orçamento saudável. Muitas pessoas subestimam ou esquecem de incluir rendas extras.',
    dicaPratica: 'Cadastre todas as fontes de renda, mesmo as pequenas. Isso te dá uma visão real do seu potencial financeiro.',
  } as LearningContent,

  despesas: {
    titulo: 'Despesas',
    descricao: 'Representa todo o dinheiro que sai do seu orçamento durante o período selecionado. Inclui contas fixas, compras, alimentação, transporte, lazer e qualquer outro gasto.',
    comoFunciona: 'O sistema soma todas as transações marcadas como "despesa" no período filtrado, incluindo gastos já pagos e os que ainda estão pendentes.',
    comoCalculado: 'Soma de todas as transações do tipo "despesa" no período selecionado (pagas + pendentes)',
    exemplo: 'Se você tem R$ 1.500 de aluguel, R$ 600 de mercado, R$ 300 de transporte e R$ 200 de lazer, suas despesas totais são R$ 2.600.',
    porqueImportante: 'Controlar despesas é essencial para não gastar mais do que ganha. A maioria das pessoas não sabe para onde vai o dinheiro até começar a anotar.',
    dicaPratica: 'Categorize suas despesas corretamente para identificar onde você pode economizar. Gastos pequenos somados fazem grande diferença!',
  } as LearningContent,

  saldoReal: {
    titulo: 'Saldo Real',
    descricao: 'O dinheiro que você realmente tem disponível AGORA. Considera apenas transações que já foram efetivamente pagas ou recebidas, excluindo valores pendentes ou futuros.',
    comoFunciona: 'Soma todas as receitas já recebidas e subtrai todas as despesas já pagas, desde o início dos seus registros até hoje. É o seu "dinheiro no bolso".',
    comoCalculado: 'Receitas (status="pago") - Despesas (status="pago") até a data de hoje',
    exemplo: 'Se você recebeu R$ 5.000 de salário e já pagou R$ 3.000 em contas, seu saldo real é R$ 2.000, mesmo que tenha mais contas para pagar.',
    porqueImportante: 'O Saldo Real mostra quanto você pode gastar hoje sem entrar no vermelho. Usar o saldo projetado para decisões de compra pode causar problemas se as receitas atrasarem.',
    dicaPratica: 'Antes de fazer uma compra grande, sempre verifique o Saldo Real, não o Projetado. Isso evita surpresas desagradáveis!',
  } as LearningContent,

  saldoProjetado: {
    titulo: 'Saldo Projetado',
    descricao: 'Uma previsão de como ficará seu saldo ao considerar TODAS as transações do período, incluindo receitas e despesas que ainda vão acontecer.',
    comoFunciona: 'Soma todas as receitas (pagas e pendentes) e subtrai todas as despesas (pagas e pendentes) do período filtrado. Mostra o cenário futuro esperado.',
    comoCalculado: 'Todas as Receitas do período - Todas as Despesas do período (independente do status)',
    exemplo: 'Se você já recebeu R$ 5.000, espera mais R$ 1.000 de freelance, e tem R$ 4.500 em contas (pagas + a pagar), seu saldo projetado é R$ 1.500.',
    porqueImportante: 'Permite planejar compras e investimentos futuros. Se o saldo projetado for negativo, você sabe que precisa cortar gastos ou buscar mais renda.',
    dicaPratica: 'Use o Saldo Projetado para planejamento, mas o Saldo Real para decisões de compra imediatas.',
  } as LearningContent,

  proximasFaturas: {
    titulo: 'Próximas Faturas de Cartão',
    descricao: 'Total das faturas de cartão de crédito que ainda não foram pagas. Inclui compras à vista e parcelas de compras parceladas.',
    comoFunciona: 'Soma todas as transações feitas em cartões de crédito que ainda não tiveram suas faturas pagas. Quando você paga a fatura, esse valor diminui.',
    comoCalculado: 'Soma de todas as transações em cartão onde status != "pago"',
    exemplo: 'Se você tem R$ 800 no cartão Nubank e R$ 500 no cartão Itaú, ambas faturas abertas, o total é R$ 1.300.',
    porqueImportante: 'Faturas de cartão são dívidas! Esse valor vai sair da sua conta quando a fatura fechar. Ignorar pode levar a juros altíssimos se não houver saldo.',
    dicaPratica: 'Mantenha esse valor sempre abaixo de 30% do seu limite total para uma boa saúde financeira e score de crédito.',
  } as LearningContent,

  saudeFinanceira: {
    titulo: 'Saúde Financeira',
    descricao: 'Um indicador que mostra se você está gastando de acordo com seu orçamento planejado ou se está acelerando demais os gastos.',
    comoFunciona: 'Compara quanto do mês já passou com quanto do orçamento você já usou. Se gastou mais proporcionalmente ao tempo, entra em alerta.',
    comoCalculado: '% Orçamento Usado vs % Mês Decorrido. Se gastou 80% do orçamento com apenas 50% do mês, status = "Atenção"',
    exemplo: 'Dia 15 (metade do mês) você já gastou 70% do orçamento de alimentação. Isso indica que vai estourar se continuar nesse ritmo.',
    porqueImportante: 'Permite ajustar gastos ANTES de estourar o orçamento. É mais fácil frear aos 70% do que recuperar depois de já ter passado de 100%.',
    dicaPratica: 'Consulte esse indicador semanalmente. Verde = siga em frente. Amarelo = reduza os gastos. Vermelho = pare e reavalie!',
  } as LearningContent,

  saldoProjetadoFimMes: {
    titulo: 'Saldo Projetado para Fim do Mês',
    descricao: 'Quanto dinheiro você deve ter no final do mês, considerando todas as receitas e despesas planejadas, comparado com sua meta de poupança.',
    comoFunciona: 'Projeta o saldo final baseado em todas as transações planejadas e compara com a meta de poupança que você definiu no orçamento.',
    comoCalculado: 'Receita Total Prevista - Despesa Total Prevista = Saldo Final. Depois compara com Meta de Poupança.',
    exemplo: 'Se você espera terminar o mês com R$ 1.200 e sua meta era R$ 1.000, você vai superar a meta em R$ 200!',
    porqueImportante: 'Mostra se você está no caminho certo para atingir suas metas financeiras. Permite ajustes durante o mês.',
    dicaPratica: 'Defina uma meta de poupança realista (recomendado: 10-20% da renda). Comece pequeno e aumente gradualmente.',
  } as LearningContent,

  envelopesDigitais: {
    titulo: 'Envelopes Digitais',
    descricao: 'Sistema de organização financeira onde você "separa" dinheiro virtual para cada categoria de gasto, como se colocasse dinheiro em envelopes físicos.',
    comoFunciona: 'Você define um limite para cada categoria (alimentação, lazer, etc.). Conforme gasta, o envelope vai esvaziando. Quando acaba, você sabe que atingiu o limite.',
    comoCalculado: 'Limite do Envelope - Gastos na Categoria = Saldo Disponível. Status muda conforme % usado (Verde < 80%, Amarelo 80-100%, Vermelho > 100%).',
    exemplo: 'Envelope "Alimentação" com R$ 800. Gastou R$ 600 = sobram R$ 200 (75% usado, status verde). Gastou R$ 850 = estourou R$ 50 (vermelho).',
    porqueImportante: 'Evita gastar demais em uma categoria às custas de outra. É a técnica mais eficaz para controle de gastos discricionários.',
    dicaPratica: 'Comece com 3-4 envelopes principais (Alimentação, Transporte, Lazer, Imprevistos). Adicione mais conforme pegar o jeito.',
  } as LearningContent,

  // =============================================
  // MENUS DO SIDEBAR
  // =============================================

  menuDashboard: {
    titulo: 'Dashboard',
    descricao: 'Visão geral de toda sua vida financeira em um só lugar. Veja receitas, despesas, saldos, gráficos e alertas importantes.',
    dicaPratica: 'Acesse diariamente para manter o controle. Gasta menos de 1 minuto e evita surpresas!',
  } as LearningContent,

  menuTransacoes: {
    titulo: 'Transações',
    descricao: 'Lista completa de todas suas movimentações financeiras. Adicione receitas, despesas, transferências. Filtre por período, categoria, conta ou status.',
    comoFunciona: 'Cada entrada ou saída de dinheiro é uma transação. Você pode marcar como paga, pendente ou recorrente.',
    dicaPratica: 'Cadastre transações no momento que acontecem. Deixar para depois faz você esquecer gastos pequenos que somam muito!',
  } as LearningContent,

  menuCartoes: {
    titulo: 'Cartões de Crédito',
    descricao: 'Gerencie seus cartões de crédito, acompanhe faturas abertas, limites disponíveis e gastos parcelados.',
    comoFunciona: 'Cadastre seus cartões com data de fechamento e vencimento. O sistema calcula automaticamente em qual fatura cada compra vai cair.',
    porqueImportante: 'Cartões mal administrados são a principal causa de endividamento no Brasil. Controlar é essencial!',
    dicaPratica: 'Nunca use mais de 30% do limite. Pague sempre a fatura total, nunca o mínimo.',
  } as LearningContent,

  menuContas: {
    titulo: 'Contas Bancárias',
    descricao: 'Cadastre suas contas correntes, poupanças e carteiras digitais. Acompanhe o saldo de cada uma separadamente.',
    comoFunciona: 'Cada conta tem seu próprio saldo. Ao registrar transações, você associa à conta correspondente para manter tudo organizado.',
    dicaPratica: 'Tenha pelo menos uma conta separada para reserva de emergência. Não misture com dinheiro do dia a dia!',
  } as LearningContent,

  menuFluxoCaixa: {
    titulo: 'Fluxo de Caixa',
    descricao: 'Visualize suas entradas e saídas de dinheiro ao longo do tempo. Identifique padrões e preveja momentos de aperto ou folga.',
    comoFunciona: 'Mostra um gráfico temporal de todas as movimentações, permitindo ver tendências e sazonalidades nos seus gastos.',
    exemplo: 'Você pode descobrir que todo dezembro gasta 40% a mais (festas, presentes) e se preparar antecipadamente.',
    dicaPratica: 'Use para planejar compras grandes. Se o fluxo mostra aperto em março, não comprometa dinheiro em fevereiro!',
  } as LearningContent,

  menuRelatorios: {
    titulo: 'Relatórios',
    descricao: 'Análises detalhadas e comparativos das suas finanças. Compare meses, veja evolução, identifique categorias que mais consomem.',
    comoFunciona: 'Gera gráficos e tabelas comparativas baseados no seu histórico de transações. Quanto mais dados, mais precisos os insights.',
    porqueImportante: 'Dados históricos revelam padrões que você não percebe no dia a dia. Conhecimento é poder!',
    dicaPratica: 'Analise mensalmente. Pergunte: "Onde posso cortar 10%?" Pequenas economias viram grandes montantes em um ano.',
  } as LearningContent,

  menuCategorias: {
    titulo: 'Categorias',
    descricao: 'Organize suas transações em categorias (Alimentação, Transporte, Lazer, etc.) e subcategorias para análises mais detalhadas.',
    comoFunciona: 'Crie categorias personalizadas. Cada transação é associada a uma categoria, permitindo ver quanto gasta em cada área da vida.',
    exemplo: 'Categoria "Alimentação" com subcategorias: Mercado, Restaurantes, Delivery, Lanches. Assim você sabe exatamente onde economizar.',
    dicaPratica: 'Não crie categorias demais (máx. 15-20). Categorias muito específicas dificultam a análise geral.',
  } as LearningContent,

  menuOrcamentos: {
    titulo: 'Orçamentos',
    descricao: 'Planeje quanto pretende gastar em cada categoria durante o mês. O sistema avisa quando você está chegando no limite.',
    comoFunciona: 'Defina um valor máximo para cada categoria. Conforme você gasta, o sistema mostra quanto já usou e quanto ainda tem disponível.',
    porqueImportante: 'Sem orçamento, você não tem controle. Com orçamento, você decide conscientemente cada gasto.',
    exemplo: 'Orçamento de R$ 500 para lazer. Gastou R$ 350 no dia 15. Sabe que tem R$ 150 para os próximos 15 dias.',
    dicaPratica: 'Comece com orçamentos baseados nos gastos atuais, depois reduza gradualmente 5-10% por mês.',
  } as LearningContent,

  menuEnvelopes: {
    titulo: 'Envelopes Digitais',
    descricao: 'Técnica clássica de finanças pessoais adaptada para o digital. Separe dinheiro virtual para cada finalidade.',
    comoFunciona: 'É como ter envelopes físicos de dinheiro. Você "coloca" uma quantia em cada envelope e só gasta o que tem ali.',
    porqueImportante: 'Método comprovado há décadas! Transforma conceitos abstratos (orçamento) em algo visual e tangível.',
    dicaPratica: 'Trate os limites como se fossem dinheiro físico. Quando acabar, acabou - não "pegue emprestado" de outro envelope!',
  } as LearningContent,

  menuCaixinhas: {
    titulo: 'Caixinhas',
    descricao: 'Metas de poupança para objetivos específicos. Junte dinheiro para viagem, celular novo, reserva de emergência, etc.',
    comoFunciona: 'Crie uma caixinha com nome, meta e prazo. Adicione dinheiro regularmente e acompanhe o progresso.',
    exemplo: 'Caixinha "Viagem 2025" com meta de R$ 5.000. Depositando R$ 500/mês, em 10 meses você atinge o objetivo!',
    porqueImportante: 'Objetivos específicos motivam mais que "guardar dinheiro". Ver o progresso aumenta a disciplina.',
    dicaPratica: 'Comece com uma caixinha de Reserva de Emergência (3-6 meses de gastos). É a base de qualquer planejamento.',
  } as LearningContent,

  menuProjecoes: {
    titulo: 'Projeções',
    descricao: 'Simule cenários futuros. Veja como suas finanças ficarão em 3, 6, 12 meses com base nos padrões atuais.',
    comoFunciona: 'O sistema analisa seu histórico e projeta receitas e despesas futuras, considerando recorrências e sazonalidades.',
    porqueImportante: 'Permite planejar grandes decisões: posso trocar de carro? Dá para casar ano que vem? Quando vou quitar a dívida?',
    dicaPratica: 'Use projeções antes de assumir compromissos financeiros longos (financiamentos, assinaturas anuais).',
  } as LearningContent,

  menuAssinaturas: {
    titulo: 'Assinaturas',
    descricao: 'Gerencie seus gastos recorrentes: streaming, academia, softwares, seguros. Veja o impacto mensal e anual.',
    comoFunciona: 'Cadastre todas as assinaturas com valor e frequência. O sistema soma o total e mostra quanto você gasta por mês e ano.',
    exemplo: 'Netflix R$ 45 + Spotify R$ 22 + Academia R$ 100 + iCloud R$ 4 = R$ 171/mês ou R$ 2.052/ano!',
    porqueImportante: 'Assinaturas são "vazamentos" silenciosos. Você esquece que paga, mas o dinheiro sai todo mês.',
    dicaPratica: 'Revise trimestralmente. Cancele o que não usa. Aquele streaming que você "vai assistir" há 6 meses? Cancele!',
  } as LearningContent,

  menuFamilia: {
    titulo: 'Família',
    descricao: 'Compartilhe o controle financeiro com familiares. Orçamento conjunto para casais ou gestão financeira familiar.',
    comoFunciona: 'Convide membros da família para acessar e contribuir com o mesmo planejamento financeiro. Todos veem os mesmos dados.',
    porqueImportante: 'Finanças são a principal causa de conflitos em relacionamentos. Transparência e planejamento conjunto evitam problemas.',
    dicaPratica: 'Alinhem expectativas antes de começar. Definam juntos as categorias, limites e metas.',
  } as LearningContent,

  menuConfiguracoes: {
    titulo: 'Configurações',
    descricao: 'Personalize o aplicativo: moeda, formato de data, notificações, aparência e preferências pessoais.',
    dicaPratica: 'Configure lembretes para registrar transações diariamente. Consistência é a chave do sucesso financeiro!',
  } as LearningContent,
}

export default learningContent
