import { CheckCircle, TrendingUp, PiggyBank, Bell, Users, ArrowRight, Check } from 'lucide-react'
import { Button } from '../components/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Landing() {
  const navigate = useNavigate()
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-lg border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-100">Pocket<span className="text-primary-500">Wise</span></span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate('/cadastro')}>
              Começar grátis
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-100 mb-6 leading-tight">
            Controle suas finanças com <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400">clareza</span> e tome decisões <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary-400 to-primary-400">seguras</span> todo dia
          </h1>

          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Saiba se pode fazer uma compra <strong className="text-gray-200">ANTES</strong> de comprometer seu orçamento
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button size="lg" onClick={() => navigate('/cadastro')} className="w-full sm:w-auto">
              Começar 7 dias grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="ghost" onClick={() => scrollToSection('como-funciona')} className="w-full sm:w-auto">
              Saiba mais ↓
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Sem cartão de crédito no teste</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problema Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-100 mb-12">
            Você já passou por isso?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              { emoji: '😰', text: 'Perdeu o controle dos gastos no meio do mês' },
              { emoji: '🤔', text: 'Não sabia se podia fazer uma compra' },
              { emoji: '💸', text: 'Estourou o orçamento sem perceber' },
              { emoji: '🎯', text: 'Não consegue guardar dinheiro' },
            ].map((item, i) => (
              <div key={i} className="bg-dark-700/30 border border-dark-600 rounded-xl p-6 text-center hover:border-primary-500/30 transition-colors">
                <div className="text-5xl mb-4">{item.emoji}</div>
                <p className="text-gray-300">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400 mb-4">
              O Pocket_Wise resolve isso
            </p>
          </div>
        </div>
      </section>

      {/* Como Funciona Section */}
      <section id="como-funciona" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-100 mb-4">
            Como funciona
          </h2>
          <p className="text-center text-gray-400 mb-16">3 passos simples para o controle total</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                number: '1',
                title: 'PLANEJE SEU MÊS',
                description: 'Distribua sua renda em categorias (supermercado, lazer, contas...)',
                icon: <PiggyBank className="w-8 h-8" />,
              },
              {
                number: '2',
                title: 'ACOMPANHE EM TEMPO REAL',
                description: 'Veja quanto ainda pode gastar em cada categoria',
                icon: <TrendingUp className="w-8 h-8" />,
              },
              {
                number: '3',
                title: 'DECIDA COM SEGURANÇA',
                description: 'Widget "Posso Comprar?" responde se você tem margem para aquela compra',
                icon: <CheckCircle className="w-8 h-8" />,
              },
            ].map((step) => (
              <div key={step.number} className="relative">
                <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border border-primary-500/30 rounded-2xl p-8 h-full hover:border-primary-500/50 transition-all">
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                    {step.number}
                  </div>

                  <div className="text-primary-400 mb-4">{step.icon}</div>
                  <h3 className="text-xl font-bold text-gray-100 mb-3">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-100 mb-16">
            Por que escolher o Pocket_Wise?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: <TrendingUp className="w-8 h-8 text-primary-400" />,
                title: 'Envelopes Digitais',
                description: 'Aloque seu dinheiro por categoria e veja visualmente quanto resta',
              },
              {
                icon: <PiggyBank className="w-8 h-8 text-green-400" />,
                title: 'Planejamento Inteligente',
                description: 'Crie seu orçamento em 5 minutos com templates prontos',
              },
              {
                icon: <Bell className="w-8 h-8 text-yellow-400" />,
                title: 'Alertas Proativos',
                description: 'Receba avisos antes de estourar qualquer categoria',
              },
              {
                icon: <Users className="w-8 h-8 text-purple-400" />,
                title: 'Gestão Familiar',
                description: 'Toda família acompanha o orçamento em tempo real',
              },
            ].map((feature, i) => (
              <div key={i} className="bg-dark-700/30 border border-dark-600 rounded-xl p-8 hover:border-primary-500/30 transition-all hover:scale-[1.02]">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-100 mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços Section */}
      <section id="precos" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-100 mb-4">
            Comece grátis por 7 dias
          </h2>
          <p className="text-center text-gray-400 mb-16">Depois escolha o melhor plano para você</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plano Mensal */}
            <div className="bg-dark-700/30 border border-dark-600 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-100 mb-2">Mensal</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-100">R$ 12,90</span>
                <span className="text-gray-400">/mês</span>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  'Cancele quando quiser',
                  'Todas as funcionalidades',
                  'Família completa incluída',
                  'Suporte prioritário',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300">
                    <Check className="w-5 h-5 text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button className="w-full" onClick={() => navigate('/cadastro')}>
                Começar teste grátis
              </Button>
            </div>

            {/* Plano Anual */}
            <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border-2 border-primary-500 rounded-2xl p-8 relative">
              <div className="absolute -top-4 right-8 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Mais Popular
              </div>

              <h3 className="text-2xl font-bold text-gray-100 mb-2">Anual</h3>
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-100">R$ 119,90</span>
                <span className="text-gray-400">/ano</span>
              </div>
              <p className="text-sm text-green-400 mb-6">Economize R$ 34,90 (23% de desconto) • R$ 9,99/mês</p>

              <ul className="space-y-3 mb-8">
                {[
                  '2 meses grátis',
                  'Todas as funcionalidades',
                  'Família completa incluída',
                  'Suporte prioritário',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300">
                    <Check className="w-5 h-5 text-green-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <Button className="w-full" onClick={() => navigate('/cadastro')}>
                Começar teste grátis
              </Button>
            </div>
          </div>

          <p className="text-center text-gray-400 mt-8 flex items-center justify-center gap-2">
            <span className="text-2xl">💯</span>
            <span>7 dias grátis - Teste sem compromisso</span>
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-100 mb-16">
            Perguntas Frequentes
          </h2>

          <div className="space-y-4">
            {[
              {
                q: 'Preciso dar cartão de crédito no teste?',
                a: 'Não! Use 7 dias completos antes de decidir.',
              },
              {
                q: 'Posso cancelar quando quiser?',
                a: 'Sim, sem multas ou burocracia. 2 cliques.',
              },
              {
                q: 'Minha família pode usar junto?',
                a: 'Sim! Usuários ilimitados no mesmo plano.',
              },
              {
                q: 'Meus dados são seguros?',
                a: '100% criptografados com Supabase (PostgreSQL).',
              },
              {
                q: 'Funciona no celular?',
                a: 'Perfeitamente! Design responsivo mobile-first.',
              },
              {
                q: 'O que acontece após os 7 dias?',
                a: 'Você escolhe se quer assinar. Sem cobranças automáticas no trial.',
              },
            ].map((item, i) => (
              <div key={i} className="bg-dark-700/30 border border-dark-600 rounded-xl overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-dark-700/50 transition-colors"
                >
                  <span className="font-semibold text-gray-100">{item.q}</span>
                  <span className="text-2xl text-gray-400">{faqOpen === i ? '−' : '+'}</span>
                </button>
                {faqOpen === i && (
                  <div className="px-6 pb-4 text-gray-400">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-6">
            Pronto para ter controle total das suas finanças?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Teste grátis por 7 dias. Sem cartão de crédito.
          </p>
          <Button size="lg" onClick={() => navigate('/cadastro')}>
            Começar agora
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-700 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-100">Pocket<span className="text-primary-500">Wise</span></span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-400">
              <button className="hover:text-gray-200 transition-colors">Termos de Uso</button>
              <button className="hover:text-gray-200 transition-colors">Política de Privacidade</button>
            </div>

            <p className="text-sm text-gray-500">
              © 2025 PocketWise. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
