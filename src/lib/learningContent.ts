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

  saldoDoPeriodo: {
    titulo: 'Saldo do Período',
    descricao: 'O resultado financeiro do período selecionado: quanto você ganhou menos quanto gastou. Considera TODAS as transações lançadas, independente do status (pago, pendente ou projetado).',
    comoFunciona: 'Soma todas as receitas do período e subtrai todas as despesas do período. Mostra o resultado das transações que você já lançou.',
    comoCalculado: 'Receitas do período - Despesas do período (todas as transações lançadas)',
    exemplo: 'Se você tem R$ 6.000 em receitas e R$ 4.500 em despesas no mês, seu saldo do período é R$ 1.500.',
    porqueImportante: 'Mostra se você está fechando o período no positivo ou negativo, considerando tudo o que foi lançado. É a "foto" da sua situação financeira no período.',
    dicaPratica: 'Compare o saldo do período com o saldo projetado para ver se está seguindo seu planejamento de orçamento.',
  } as LearningContent,

  saldoProjetado: {
    titulo: 'Saldo Projetado',
    descricao: 'Quanto dinheiro você deve ter no final do mês se seguir o orçamento planejado. Considera as receitas previstas menos TODO o orçamento definido para despesas.',
    comoFunciona: 'Usa o orçamento que você criou: soma suas receitas orçadas e subtrai todas as despesas que você planejou gastar (mesmo as que ainda não foram lançadas).',
    comoCalculado: 'Receitas Orçadas - Total de Despesas Orçadas (inclui gastos planejados não lançados)',
    exemplo: 'Você orçou R$ 6.000 de receita e R$ 5.000 em despesas. Mesmo que ainda não tenha lançado todas as despesas, seu saldo projetado é R$ 1.000.',
    porqueImportante: 'Mostra se seu planejamento de orçamento é viável. Se for negativo, você precisa revisar o orçamento antes mesmo de gastar!',
    dicaPratica: 'O saldo projetado é sua "meta" de sobra. Se o saldo do período estiver acima dele, você está gastando menos que o planejado - ótimo!',
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

  // =============================================
  // PÁGINA DE ORÇAMENTOS
  // =============================================

  orcamentoResumo: {
    titulo: 'Resumo do Orçamento',
    descricao: 'Visão consolidada de como está seu orçamento no mês atual: quanto planejou, quanto gastou e quanto ainda pode gastar.',
    comoFunciona: 'Soma todos os valores orçados por categoria e compara com os gastos reais registrados no mês.',
    comoCalculado: 'Total Orçado = soma de todas as categorias. % Usado = (Total Gasto / Total Orçado) × 100',
    exemplo: 'Orçamento de R$ 5.000, gastos de R$ 3.500 = 70% usado. Sobram R$ 1.500 para o resto do mês.',
    dicaPratica: 'Revise semanalmente para ajustar categorias que estão estourando.',
  } as LearningContent,

  orcamentoAlertas: {
    titulo: 'Alertas de Orçamento',
    descricao: 'Avisos automáticos quando alguma categoria está perto de estourar ou já ultrapassou o limite definido.',
    comoFunciona: 'O sistema monitora cada categoria e gera alertas: Amarelo quando passa de 80%, Vermelho quando estoura 100%.',
    porqueImportante: 'Alertas precoces permitem ajustar gastos antes que seja tarde. Prevenir é melhor que remediar!',
    dicaPratica: 'Quando receber um alerta amarelo, pause gastos nessa categoria até o fim do mês.',
  } as LearningContent,

  orcamentoMetaPoupanca: {
    titulo: 'Meta de Poupança',
    descricao: 'Quanto você deseja guardar por mês. É a diferença entre sua renda e seus gastos planejados.',
    comoFunciona: 'Você define um valor fixo ou percentual da renda. O sistema acompanha se você está conseguindo atingir.',
    comoCalculado: 'Meta Atingível = Receitas Previstas - Total Orçado em Despesas',
    exemplo: 'Renda de R$ 6.000, despesas orçadas de R$ 5.000 = meta de poupança possível de R$ 1.000 (16,7%).',
    porqueImportante: 'Quem não define meta, não poupa. Especialistas recomendam guardar no mínimo 10% da renda.',
    dicaPratica: 'Comece com 5% se estiver apertado. O importante é criar o hábito. Aumente gradualmente.',
  } as LearningContent,

  orcamentoPossoComprar: {
    titulo: 'Posso Comprar?',
    descricao: 'Simulador rápido para verificar se uma compra cabe no seu orçamento atual sem comprometer outras categorias.',
    comoFunciona: 'Você informa o valor e a categoria. O sistema verifica se tem saldo disponível no envelope correspondente.',
    exemplo: 'Quer comprar um tênis de R$ 300. Envelope "Vestuário" tem R$ 450 disponíveis. Pode comprar!',
    porqueImportante: 'Evita compras por impulso que estourem o orçamento. Dá segurança para gastar sem culpa.',
    dicaPratica: 'Use SEMPRE antes de compras não planejadas. Se não cabe, espere o próximo mês ou reavalie prioridades.',
  } as LearningContent,

  orcamentoComparativo: {
    titulo: 'Relatório Comparativo',
    descricao: 'Compare seu orçamento atual com meses anteriores. Veja se está gastando mais ou menos em cada categoria.',
    comoFunciona: 'Mostra lado a lado os valores orçados e gastos de diferentes meses, destacando variações.',
    porqueImportante: 'Identificar tendências ajuda a ajustar o orçamento. Gastos crescendo? Hora de agir!',
    dicaPratica: 'Compare sempre com o mesmo mês do ano anterior quando houver sazonalidade (ex: dezembro).',
  } as LearningContent,

  // =============================================
  // PÁGINA DE ENVELOPES
  // =============================================

  envelopeTotalOrcado: {
    titulo: 'Total Orçado',
    descricao: 'Soma de todos os valores que você separou para os envelopes do mês. Representa seu limite total de gastos variáveis.',
    comoFunciona: 'Cada categoria com valor orçado vira um envelope. A soma de todos os envelopes é o Total Orçado.',
    exemplo: 'Alimentação R$ 1.200 + Transporte R$ 400 + Lazer R$ 300 + Outros R$ 500 = Total de R$ 2.400.',
    porqueImportante: 'Esse valor deve ser menor que sua renda disponível após pagar contas fixas.',
    dicaPratica: 'Deixe sempre uma margem de 10-15% para imprevistos fora dos envelopes.',
  } as LearningContent,

  envelopeTotalGasto: {
    titulo: 'Total Gasto',
    descricao: 'Quanto você já gastou em todas as categorias com envelope no mês atual.',
    comoFunciona: 'Soma todas as transações categorizadas que estão vinculadas aos envelopes ativos.',
    comoCalculado: 'Soma de todas as despesas pagas nas categorias que têm envelope ativo',
    exemplo: 'Se gastou R$ 800 em Alimentação, R$ 250 em Transporte e R$ 180 em Lazer, total gasto = R$ 1.230.',
    dicaPratica: 'Acompanhe esse valor pelo menos 2x por semana para não ter surpresas.',
  } as LearningContent,

  envelopeDisponivel: {
    titulo: 'Disponível',
    descricao: 'Quanto dinheiro você ainda pode gastar nos envelopes até o fim do mês.',
    comoFunciona: 'Subtrai o total gasto do total orçado para mostrar a margem restante.',
    comoCalculado: 'Disponível = Total Orçado - Total Gasto',
    exemplo: 'Orçado R$ 2.400, gasto R$ 1.230 = disponível R$ 1.170 para o resto do mês.',
    porqueImportante: 'Esse é seu "colchão de segurança". Quanto maior, mais tranquilo você fica.',
    dicaPratica: 'Se estiver no dia 20 e já gastou mais de 80%, reduza drasticamente os gastos na última semana.',
  } as LearningContent,

  envelopeSaudeGeral: {
    titulo: 'Saúde Geral dos Envelopes',
    descricao: 'Indicador que mostra quantos envelopes estão saudáveis, em atenção ou críticos.',
    comoFunciona: 'Conta quantos envelopes estão em cada status baseado no percentual de uso.',
    comoCalculado: 'OK = < 80% usado | Atenção = 80-100% | Crítico = > 100%',
    exemplo: 'De 6 envelopes: 4 OK, 1 em Atenção, 1 Crítico. Foque em ajustar os problemáticos!',
    dicaPratica: 'Ideal é ter todos verdes. Se algum está sempre vermelho, o valor orçado pode estar baixo demais.',
  } as LearningContent,

  envelopePrioridade: {
    titulo: 'Prioridade do Envelope',
    descricao: 'Classifica categorias em Essencial, Importante ou Desejável para ajudar na tomada de decisão.',
    comoFunciona: 'Você define a prioridade ao criar o envelope. Em momentos de aperto, corte primeiro os Desejáveis.',
    exemplo: 'Essencial: Alimentação, Transporte. Importante: Saúde, Educação. Desejável: Lazer, Streaming.',
    porqueImportante: 'Ajuda a tomar decisões rápidas quando precisa cortar gastos. Não corte essenciais!',
    dicaPratica: 'Se estourar, NUNCA tire de Essencial para cobrir Desejável. Faça o contrário.',
  } as LearningContent,

  envelopeRebalanceamento: {
    titulo: 'Rebalanceamento',
    descricao: 'Transferir dinheiro de um envelope que está sobrando para outro que vai estourar.',
    comoFunciona: 'Você pode mover valores entre envelopes durante o mês para ajustar o orçamento à realidade.',
    exemplo: 'Lazer sobrando R$ 150, Alimentação faltando R$ 100. Transfira R$ 100 de Lazer para Alimentação.',
    porqueImportante: 'Flexibilidade é importante! A vida muda e o orçamento precisa acompanhar.',
    dicaPratica: 'Rebalanceie no máximo 1-2x por mês. Se precisa fazer sempre, reveja os valores iniciais.',
  } as LearningContent,

  // =============================================
  // PÁGINA DE FLUXO DE CAIXA
  // =============================================

  fluxoSaldoInicial: {
    titulo: 'Saldo Inicial',
    descricao: 'Quanto dinheiro você tem nas suas contas bancárias hoje. É o ponto de partida da projeção.',
    comoFunciona: 'Soma os saldos de todas as suas contas cadastradas para obter o valor inicial.',
    exemplo: 'Conta Corrente R$ 2.000 + Poupança R$ 3.000 + Nubank R$ 500 = Saldo Inicial R$ 5.500.',
    porqueImportante: 'Se o saldo inicial estiver incorreto, toda a projeção será errada.',
    dicaPratica: 'Confira regularmente se os saldos das contas estão atualizados.',
  } as LearningContent,

  fluxoTotalReceitas: {
    titulo: 'Total de Receitas no Período',
    descricao: 'Soma de todas as entradas de dinheiro previstas para o período selecionado (7, 15, 30, 60 ou 90 dias).',
    comoFunciona: 'Considera receitas já recebidas e as pendentes/projetadas que estão dentro do período.',
    exemplo: 'Nos próximos 30 dias: Salário R$ 5.000 + Freelance R$ 800 + Rendimentos R$ 100 = R$ 5.900.',
    dicaPratica: 'Seja conservador nas projeções. Receitas incertas podem não se concretizar.',
  } as LearningContent,

  fluxoTotalDespesas: {
    titulo: 'Total de Despesas no Período',
    descricao: 'Soma de todas as saídas de dinheiro previstas para o período selecionado.',
    comoFunciona: 'Inclui contas fixas, parcelas, assinaturas e despesas variáveis já cadastradas.',
    exemplo: 'Aluguel R$ 1.500 + Parcelas R$ 800 + Assinaturas R$ 200 + Variáveis R$ 1.000 = R$ 3.500.',
    porqueImportante: 'Saber o que vai sair evita surpresas. Muita gente esquece parcelas de cartão!',
    dicaPratica: 'Cadastre todas as despesas recorrentes. Use lembretes para não esquecer.',
  } as LearningContent,

  fluxoSaldoFinal: {
    titulo: 'Saldo Final Projetado',
    descricao: 'Quanto dinheiro você deve ter ao final do período, se tudo acontecer como planejado.',
    comoFunciona: 'Saldo Inicial + Receitas do Período - Despesas do Período = Saldo Final.',
    comoCalculado: 'Saldo Final = Saldo Inicial + Receitas - Despesas',
    exemplo: 'Inicial R$ 5.500 + Receitas R$ 5.900 - Despesas R$ 3.500 = Saldo Final R$ 7.900.',
    porqueImportante: 'Se o saldo final for negativo, você precisa agir AGORA para evitar ficar no vermelho.',
    dicaPratica: 'Mantenha sempre uma reserva. Saldo Final muito apertado é sinal de alerta.',
  } as LearningContent,

  fluxoMenorSaldo: {
    titulo: 'Menor Saldo no Período',
    descricao: 'O menor valor que seu saldo vai atingir durante o período. Identifica o "gargalo" financeiro.',
    comoFunciona: 'Analisa o saldo dia a dia e encontra o ponto mais crítico.',
    exemplo: 'Saldo inicial R$ 5.500, mas no dia 15 (antes do salário) vai ficar R$ 500. Esse é o menor saldo.',
    porqueImportante: 'Mesmo que o saldo final seja positivo, você pode ficar negativo no meio do caminho!',
    dicaPratica: 'Se o menor saldo for negativo ou muito baixo, antecipe despesas ou adie gastos não essenciais.',
  } as LearningContent,

  fluxoAlertaNegativo: {
    titulo: 'Alerta de Saldo Negativo',
    descricao: 'Aviso quando a projeção indica que você ficará com saldo negativo em algum dia do período.',
    comoFunciona: 'O sistema simula o saldo dia a dia e alerta se algum dia ficar negativo.',
    porqueImportante: 'Saldo negativo = cheque especial, juros altos, nome sujo. Evite a todo custo!',
    dicaPratica: 'Ao ver esse alerta, corte gastos imediatamente ou busque antecipar uma receita.',
  } as LearningContent,

  fluxoEvolucaoSaldo: {
    titulo: 'Gráfico de Evolução do Saldo',
    descricao: 'Visualização da trajetória do seu saldo ao longo dos dias, mostrando subidas (receitas) e descidas (despesas).',
    comoFunciona: 'Cada ponto no gráfico é o saldo previsto para aquele dia. A linha mostra a tendência.',
    exemplo: 'A linha sobe nos dias de salário e desce nos dias de contas. Identifique os "vales".',
    dicaPratica: 'Use o gráfico para encontrar o melhor momento de fazer compras grandes.',
  } as LearningContent,

  // =============================================
  // PÁGINA DE ASSINATURAS
  // =============================================

  assinaturasTotalMensal: {
    titulo: 'Custo Mensal em Assinaturas',
    descricao: 'Soma de todas as suas assinaturas convertidas para valor mensal. Mostra o impacto fixo no orçamento.',
    comoFunciona: 'Soma assinaturas mensais direto e divide anuais por 12 para ter o custo mensal equivalente.',
    comoCalculado: 'Mensais + (Anuais ÷ 12) = Custo Mensal Total',
    exemplo: 'Netflix R$ 45/mês + Amazon Prime R$ 119/ano (R$ 9,90/mês) = R$ 54,90/mês.',
    porqueImportante: 'Assinaturas parecem baratas isoladas, mas somadas podem representar 10-20% da renda!',
    dicaPratica: 'Se passar de 5% da renda em assinaturas, está na hora de cortar.',
  } as LearningContent,

  assinaturasTotalAnual: {
    titulo: 'Custo Anual em Assinaturas',
    descricao: 'Projeção de quanto você vai gastar em assinaturas durante um ano inteiro.',
    comoFunciona: 'Multiplica mensais por 12 e soma com anuais para ter a visão de um ano completo.',
    comoCalculado: '(Mensais × 12) + Anuais = Custo Anual Total',
    exemplo: 'Custo mensal R$ 200 × 12 meses = R$ 2.400/ano em assinaturas.',
    porqueImportante: 'Ver o valor anual causa mais impacto. R$ 50/mês parece pouco, mas são R$ 600/ano!',
    dicaPratica: 'Pergunte-se: "Eu pagaria R$ X à vista por isso?" Se não, cancele.',
  } as LearningContent,

  assinaturasAtivas: {
    titulo: 'Assinaturas Ativas',
    descricao: 'Quantidade de serviços que você está pagando atualmente de forma recorrente.',
    comoFunciona: 'Conta todas as assinaturas que não foram canceladas.',
    exemplo: 'Netflix, Spotify, Amazon, Academia, Celular = 5 assinaturas ativas.',
    porqueImportante: 'Quanto mais assinaturas, mais difícil controlar. Menos é mais!',
    dicaPratica: 'Tente manter no máximo 5-7 assinaturas. Mais que isso, provavelmente tem coisa sobrando.',
  } as LearningContent,

  assinaturasSincronizar: {
    titulo: 'Sincronizar Lançamentos',
    descricao: 'Gera automaticamente as transações de assinatura para o mês atual, evitando cadastro manual.',
    comoFunciona: 'O sistema cria uma transação para cada assinatura ativa, já categorizada e com a data correta.',
    exemplo: 'Ao sincronizar, o sistema cria: "Netflix - R$ 45 - dia 10", "Spotify - R$ 22 - dia 5".',
    dicaPratica: 'Sincronize no início de cada mês para ter todas as assinaturas já cadastradas.',
  } as LearningContent,

  assinaturasProximaCobranca: {
    titulo: 'Próxima Cobrança',
    descricao: 'Data prevista para a próxima cobrança da assinatura no seu cartão ou conta.',
    comoFunciona: 'Calcula baseado na frequência (mensal, anual) e na data da última cobrança.',
    exemplo: 'Netflix cobrança dia 10. Hoje é dia 5. Próxima cobrança em 5 dias.',
    porqueImportante: 'Saber quando vem a cobrança ajuda a manter saldo na conta.',
    dicaPratica: 'Configure alertas para lembrar um dia antes de cobranças importantes.',
  } as LearningContent,

  // =============================================
  // PÁGINA DE PROJEÇÕES
  // =============================================

  projecaoSaldoProximoMes: {
    titulo: 'Saldo Projetado - Próximo Mês',
    descricao: 'Estimativa de quanto você terá disponível no próximo mês, baseado nos padrões atuais.',
    comoFunciona: 'Projeta receitas recorrentes menos despesas previstas (fixas + estimativa de variáveis).',
    exemplo: 'Receita prevista R$ 6.000 - Despesas fixas R$ 4.000 - Variáveis R$ 1.500 = Saldo R$ 500.',
    porqueImportante: 'Antecipar o próximo mês permite ajustes no mês atual.',
    dicaPratica: 'Se a projeção está negativa, comece a economizar HOJE, não mês que vem.',
  } as LearningContent,

  projecaoParcelasPendentes: {
    titulo: 'Total de Parcelas Pendentes',
    descricao: 'Soma de todas as parcelas que ainda vão vencer de compras parceladas.',
    comoFunciona: 'Encontra todas as transações parceladas e soma os valores das parcelas não pagas.',
    comoCalculado: 'Soma das parcelas com status != "pago" de transações parceladas',
    exemplo: 'TV 12x R$ 200 (faltam 8) = R$ 1.600 + Celular 10x R$ 150 (faltam 3) = R$ 450. Total: R$ 2.050.',
    porqueImportante: 'Parcelas são compromissos futuros. Esse dinheiro já está "gasto", mesmo que ainda não tenha saído.',
    dicaPratica: 'Antes de parcelar algo novo, veja quanto já tem comprometido em parcelas.',
  } as LearningContent,

  projecaoProximos3Meses: {
    titulo: 'Compromissos - Próximos 3 Meses',
    descricao: 'Total de parcelas que vão vencer nos próximos 3 meses.',
    comoFunciona: 'Filtra parcelas com vencimento nos próximos 90 dias e soma os valores.',
    exemplo: 'Mês 1: R$ 800 + Mês 2: R$ 800 + Mês 3: R$ 600 = R$ 2.200 em parcelas.',
    porqueImportante: 'Visão de curto prazo para planejamento de caixa.',
    dicaPratica: 'Se esse valor for maior que 30% da sua renda de 3 meses, você está muito comprometido.',
  } as LearningContent,

  projecaoParcelamentosAtivos: {
    titulo: 'Parcelamentos Ativos',
    descricao: 'Quantidade de compras parceladas que você ainda está pagando.',
    comoFunciona: 'Conta grupos de parcelas distintos que ainda têm parcelas a vencer.',
    exemplo: 'TV (8 parcelas), Celular (3 parcelas), Sofá (6 parcelas) = 3 parcelamentos ativos.',
    porqueImportante: 'Muitos parcelamentos complicam o controle e comprometem renda futura.',
    dicaPratica: 'Tente ter no máximo 3-4 parcelamentos ativos. Quite um antes de começar outro.',
  } as LearningContent,

  projecaoGrafico: {
    titulo: 'Gráfico de Projeção 6 Meses',
    descricao: 'Visualização de como suas finanças devem evoluir nos próximos 6 meses.',
    comoFunciona: 'Projeta receitas, despesas e parcelas para cada mês futuro e mostra em barras.',
    exemplo: 'O gráfico mostra se você vai conseguir poupar ou se vai ficar apertado em algum mês.',
    dicaPratica: 'Use para identificar meses críticos e se preparar com antecedência.',
  } as LearningContent,

  // =============================================
  // PÁGINA DE CAIXINHAS
  // =============================================

  caixinhaTotalGuardado: {
    titulo: 'Total Guardado',
    descricao: 'Soma de todo o dinheiro que você já depositou em todas as suas caixinhas.',
    comoFunciona: 'Soma os saldos atuais de todas as caixinhas ativas.',
    exemplo: 'Emergência R$ 5.000 + Viagem R$ 2.500 + Celular R$ 800 = R$ 8.300 guardados.',
    porqueImportante: 'Mostra seu progresso total de poupança. Cada real guardado é uma conquista!',
    dicaPratica: 'Defina uma meta de total guardado (ex: 6 meses de gastos) e acompanhe o progresso.',
  } as LearningContent,

  caixinhaMetaTotal: {
    titulo: 'Meta Total',
    descricao: 'Soma de todas as metas definidas nas suas caixinhas.',
    comoFunciona: 'Soma os valores de meta de todas as caixinhas que têm meta definida.',
    exemplo: 'Emergência (meta R$ 10.000) + Viagem (meta R$ 5.000) + Celular (meta R$ 3.000) = Meta Total R$ 18.000.',
    dicaPratica: 'Seja realista nas metas. Metas muito altas desmotivam.',
  } as LearningContent,

  caixinhaProgressoGeral: {
    titulo: 'Progresso Médio',
    descricao: 'Percentual médio de conclusão de todas as suas caixinhas.',
    comoFunciona: 'Calcula o progresso de cada caixinha e faz a média.',
    comoCalculado: 'Média de (Saldo / Meta × 100) de cada caixinha',
    exemplo: 'Emergência 50% + Viagem 30% + Celular 80% = Média 53%.',
    dicaPratica: 'Foque em completar uma caixinha de cada vez. Dispersar esforço atrasa todas.',
  } as LearningContent,

  caixinhaTipoObjetivo: {
    titulo: 'Caixinha de Objetivo',
    descricao: 'Para guardar dinheiro para algo específico com data definida: viagem, celular, entrada de carro.',
    comoFunciona: 'Você define o valor total e o prazo. O sistema calcula quanto depositar por mês.',
    exemplo: 'Viagem de R$ 6.000 em 12 meses = R$ 500/mês de depósito.',
    porqueImportante: 'Objetivos tangíveis motivam. Você sabe exatamente para quê está guardando.',
    dicaPratica: 'Dê nomes divertidos às caixinhas. "Férias dos Sonhos" motiva mais que "Viagem".',
  } as LearningContent,

  caixinhaTipoEmergencia: {
    titulo: 'Reserva de Emergência',
    descricao: 'Dinheiro guardado para imprevistos: perda de emprego, problemas de saúde, consertos urgentes.',
    comoFunciona: 'Você define um valor baseado nos seus gastos mensais (recomendado: 3-6 meses).',
    exemplo: 'Gastos mensais de R$ 4.000 × 6 meses = Reserva ideal de R$ 24.000.',
    porqueImportante: 'É a base de qualquer planejamento financeiro. Sem ela, qualquer imprevisto vira uma crise.',
    dicaPratica: 'PRIORIDADE número 1! Construa a reserva antes de qualquer outro objetivo.',
  } as LearningContent,

  caixinhaDepositar: {
    titulo: 'Depositar na Caixinha',
    descricao: 'Adicionar dinheiro à caixinha. O valor sai do seu saldo disponível e vai para a caixinha.',
    comoFunciona: 'Você informa o valor, e o sistema registra o depósito aumentando o saldo da caixinha.',
    dicaPratica: 'Automatize! Configure transferência automática no dia do salário para não esquecer.',
  } as LearningContent,

  caixinhaRetirar: {
    titulo: 'Retirar da Caixinha',
    descricao: 'Sacar dinheiro da caixinha para usar. Diminui o saldo e o progresso.',
    comoFunciona: 'Você informa o valor e o motivo. O sistema registra a retirada.',
    porqueImportante: 'Retirar deve ser exceção, não regra. Cada retirada atrasa o objetivo.',
    dicaPratica: 'Para emergência, use. Para "oportunidades", pense duas vezes antes de sacar.',
  } as LearningContent,

  // =============================================
  // PÁGINA DE RELATÓRIOS
  // =============================================

  relatorioComparativo: {
    titulo: 'Comparação entre Períodos',
    descricao: 'Compare dois meses lado a lado para identificar mudanças nos seus padrões de gastos.',
    comoFunciona: 'Selecione dois meses e veja receitas, despesas e saldos de cada um, com a variação.',
    exemplo: 'Janeiro gastou R$ 4.000, Fevereiro gastou R$ 5.200 = Aumento de R$ 1.200 (30%).',
    porqueImportante: 'Comparar revela tendências. Gastos subindo mês a mês? Hora de agir!',
    dicaPratica: 'Compare meses similares. Janeiro com Janeiro, não Janeiro com Julho.',
  } as LearningContent,

  relatorioVariacao: {
    titulo: 'Variação',
    descricao: 'Diferença entre dois valores, mostrando se houve aumento ou diminuição.',
    comoFunciona: 'Subtrai o valor do período 1 do período 2. Positivo = aumentou, Negativo = diminuiu.',
    comoCalculado: 'Variação = Período 2 - Período 1',
    exemplo: 'Despesas: Janeiro R$ 4.000, Fevereiro R$ 5.200. Variação: +R$ 1.200.',
    porqueImportante: 'Para despesas, variação negativa é boa (gastou menos). Para receitas, positiva é boa.',
    dicaPratica: 'Investigue variações grandes (> 20%). O que causou essa mudança?',
  } as LearningContent,

  relatorioEvolucao: {
    titulo: 'Evolução dos Últimos 6 Meses',
    descricao: 'Gráfico de linha mostrando como receitas, despesas e saldo evoluíram ao longo dos meses.',
    comoFunciona: 'Calcula os valores mensais e plota em um gráfico de linha para visualizar tendências.',
    exemplo: 'A linha de despesas está subindo? A de receitas está estável? Você está poupando menos!',
    porqueImportante: 'Tendências de longo prazo são mais importantes que um mês isolado.',
    dicaPratica: 'O ideal: linha de receitas acima da de despesas, e a distância entre elas aumentando.',
  } as LearningContent,

  relatorioCategoria: {
    titulo: 'Comparação por Categoria',
    descricao: 'Veja como cada categoria se comportou entre dois períodos.',
    comoFunciona: 'Lista todas as categorias com gastos nos dois períodos e mostra a variação de cada uma.',
    exemplo: 'Alimentação: Jan R$ 800, Fev R$ 1.100 = +R$ 300 (+37%). Delivery aumentou muito!',
    porqueImportante: 'Identificar qual categoria está puxando o total para cima.',
    dicaPratica: 'Foque nas top 3 categorias com maior aumento. São elas que vão fazer diferença.',
  } as LearningContent,

  relatorioPercentual: {
    titulo: 'Variação Percentual',
    descricao: 'Mostra a variação em porcentagem, facilitando comparar categorias de valores diferentes.',
    comoFunciona: 'Calcula quanto o valor mudou em relação ao original.',
    comoCalculado: '% Variação = ((Novo - Antigo) / Antigo) × 100',
    exemplo: 'Alimentação subiu de R$ 800 para R$ 1.000 = +25%. Transporte de R$ 200 para R$ 240 = +20%.',
    porqueImportante: 'R$ 200 de aumento em R$ 800 é mais grave que R$ 200 em R$ 3.000.',
    dicaPratica: 'Variações acima de 20% merecem atenção especial.',
  } as LearningContent,
}

export default learningContent
