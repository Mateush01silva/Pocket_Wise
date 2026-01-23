/**
 * ================================================================
 * Script de Limpeza de Dados Transacionais - LocalStorage
 * ================================================================
 * Este script remove todos os dados de transações, orçamentos e
 * envelopes do LocalStorage, mas mantém as configurações
 *
 * USO: Cole este código no Console do navegador (F12)
 * ================================================================
 */

(() => {
  console.log('🧹 Iniciando limpeza de dados transacionais...\n');

  // Função auxiliar para limpar uma store específica
  const limparStore = (key, manterCampos = []) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) {
        console.log(`⏭️  ${key}: não encontrado`);
        return;
      }

      const data = JSON.parse(item);

      if (manterCampos.length > 0) {
        // Manter apenas campos específicos
        const novoData = { state: {} };
        manterCampos.forEach(campo => {
          if (data.state && data.state[campo]) {
            novoData.state[campo] = data.state[campo];
          }
        });
        localStorage.setItem(key, JSON.stringify(novoData));
        console.log(`✅ ${key}: campos mantidos:`, manterCampos);
      } else {
        // Deletar completamente
        localStorage.removeItem(key);
        console.log(`❌ ${key}: removido completamente`);
      }
    } catch (error) {
      console.error(`❗ Erro ao limpar ${key}:`, error);
    }
  };

  // Função para resetar saldos das contas
  const resetarSaldosContas = () => {
    try {
      const key = 'pocketwise-contas-bancarias-store';
      const item = localStorage.getItem(key);
      if (!item) return;

      const data = JSON.parse(item);
      if (data.state && data.state.contas) {
        data.state.contas = data.state.contas.map(conta => ({
          ...conta,
          saldo_atual: conta.saldo_inicial
        }));
        localStorage.setItem(key, JSON.stringify(data));
        console.log('💰 Saldos das contas resetados para saldo inicial');
      }
    } catch (error) {
      console.error('❗ Erro ao resetar saldos:', error);
    }
  };

  console.log('═══════════════════════════════════════════════\n');

  // 1. Limpar transações (lançamentos)
  limparStore('pocketwise-transacoes-store');

  // 2. Limpar orçamentos
  limparStore('pocketwise-orcamentos-store');

  // 3. Limpar envelopes
  limparStore('pocketwise-envelopes-store');

  // 4. Limpar patrimônio (opcional - descomente se quiser)
  // limparStore('pocketwise-patrimonio-store');

  // 5. Limpar assinaturas (opcional - descomente se quiser)
  // limparStore('pocketwise-assinaturas-store');

  // 6. Resetar saldos das contas bancárias
  resetarSaldosContas();

  console.log('\n═══════════════════════════════════════════════');
  console.log('🎉 Limpeza concluída!\n');

  // Mostrar o que foi mantido
  console.log('✅ MANTIDO:');
  console.log('  - Cartões de crédito');
  console.log('  - Contas bancárias (saldo resetado)');
  console.log('  - Categorias e subcategorias');
  console.log('  - Configurações de família');
  console.log('');
  console.log('❌ REMOVIDO:');
  console.log('  - Todas as transações');
  console.log('  - Todos os orçamentos');
  console.log('  - Todos os envelopes');
  console.log('');
  console.log('🔄 Recarregue a página para ver as mudanças');
  console.log('═══════════════════════════════════════════════\n');

  // Listar stores mantidos
  console.log('📦 Stores mantidos no LocalStorage:');
  const storesManutencao = [
    'pocketwise-cartoes-store',
    'pocketwise-contas-bancarias-store',
    'pocketwise-categorias-store',
    'pocketwise-family-store'
  ];

  storesManutencao.forEach(key => {
    const item = localStorage.getItem(key);
    if (item) {
      try {
        const data = JSON.parse(item);
        const count = data.state ? Object.keys(data.state).length : 0;
        console.log(`  ✓ ${key}: ${count} campo(s)`);
      } catch (e) {
        console.log(`  ✓ ${key}: presente`);
      }
    }
  });

  // Perguntar se quer recarregar
  const reload = confirm('Limpeza concluída! Deseja recarregar a página agora?');
  if (reload) {
    location.reload();
  }
})();
