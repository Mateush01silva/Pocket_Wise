import { CheckCircle, TrendingUp, PiggyBank, Bell, Users, ArrowRight, Check, Smartphone, ChevronDown, Download, BarChart3, DollarSign } from 'lucide-react'
import { Button } from '../components/ui'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPlatformStats, type PlatformStats } from '../services/statsService'

function AnimatedCounter({ end, duration = 2000, prefix = '', suffix = '' }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (!hasStarted || end === 0) return

    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setCount(Math.floor(eased * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration, hasStarted])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true)
        }
      },
      { threshold: 0.3 }
    )

    const el = document.getElementById('stats-section')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (end >= 1_000_000) {
    const value = (count / 1_000_000).toFixed(1).replace('.', ',')
    return <>{prefix}{value}M{suffix}</>
  }
  if (end >= 1_000) {
    const value = (count / 1_000).toFixed(1).replace('.', ',')
    return <>{prefix}{value}K{suffix}</>
  }
  return <>{prefix}{count.toLocaleString('pt-BR')}{suffix}</>
}

export function Landing() {
  const navigate = useNavigate()
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [installGuideOpen, setInstallGuideOpen] = useState(false)
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalTransactions: 0,
    totalMoneyManaged: 0,
  })

  useEffect(() => {
    getPlatformStats().then(setStats)
  }, [])

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const hasStats = stats.totalUsers > 0 || stats.totalTransactions > 0 || stats.totalMoneyManaged > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-lg border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/__Logo_PocketWise-removebg-preview.png"
              alt="PocketWise"
              className="w-8 h-8 object-contain"
            />
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

      {/* Stats Section - Números da plataforma */}
      {hasStats && (
        <section id="stats-section" className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-100 mb-12">
              Números que comprovam a confiança
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-primary-500/10 to-primary-500/5 border border-primary-500/20 rounded-2xl p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-14 h-14 bg-primary-500/20 rounded-full flex items-center justify-center">
                    <Users className="w-7 h-7 text-primary-400" />
                  </div>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-gray-100 mb-2">
                  <AnimatedCounter end={stats.totalUsers} prefix="" suffix="+" />
                </div>
                <p className="text-gray-400 text-lg">Usuários ativos</p>
              </div>

              <div className="bg-gradient-to-br from-secondary-500/10 to-secondary-500/5 border border-secondary-500/20 rounded-2xl p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-14 h-14 bg-secondary-500/20 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-7 h-7 text-secondary-400" />
                  </div>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-gray-100 mb-2">
                  <AnimatedCounter end={stats.totalTransactions} prefix="" suffix="+" />
                </div>
                <p className="text-gray-400 text-lg">Transações registradas</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 rounded-2xl p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center">
                    <DollarSign className="w-7 h-7 text-green-400" />
                  </div>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-gray-100 mb-2">
                  <AnimatedCounter end={stats.totalMoneyManaged} prefix="R$ " />
                </div>
                <p className="text-gray-400 text-lg">Já administrados na plataforma</p>
              </div>
            </div>
          </div>
        </section>
      )}

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
              O Pocket Wise resolve isso
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
            Por que escolher o Pocket Wise?
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

      {/* Instale no Celular - PWA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border border-primary-500/30 rounded-2xl p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-2">
                  Instale no seu celular
                </h2>
                <p className="text-gray-400 text-lg">
                  Use o Pocket Wise como um aplicativo nativo, direto na tela inicial do seu celular. Sem precisar baixar na loja!
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
              <div className="flex items-center gap-3 text-gray-300">
                <Download className="w-5 h-5 text-green-400" />
                <span>Rápido e leve</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Smartphone className="w-5 h-5 text-primary-400" />
                <span>Funciona como app nativo</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <CheckCircle className="w-5 h-5 text-secondary-400" />
                <span>Sem ocupar espaço</span>
              </div>
            </div>

            {/* Botão para abrir passo a passo */}
            <button
              onClick={() => setInstallGuideOpen(!installGuideOpen)}
              className="w-full flex items-center justify-between bg-dark-700/50 hover:bg-dark-700/80 border border-dark-600 rounded-xl px-6 py-4 transition-colors"
            >
              <span className="font-semibold text-gray-100">Como instalar? Veja o passo a passo</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${installGuideOpen ? 'rotate-180' : ''}`} />
            </button>

            {installGuideOpen && (
              <div className="mt-6 space-y-6">
                {/* Android / Chrome */}
                <div className="bg-dark-800/60 rounded-xl p-6 border border-dark-600">
                  <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🤖</span> Android (Chrome)
                  </h3>
                  <ol className="space-y-3">
                    {[
                      'Abra o Pocket Wise no navegador Chrome',
                      'Toque no menu (3 pontinhos) no canto superior direito',
                      'Selecione "Instalar aplicativo" ou "Adicionar à tela inicial"',
                      'Confirme tocando em "Instalar"',
                      'Pronto! O ícone aparecerá na sua tela inicial',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-300">
                        <span className="flex-shrink-0 w-7 h-7 bg-primary-500/20 text-primary-400 rounded-full flex items-center justify-center text-sm font-bold">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* iPhone / Safari */}
                <div className="bg-dark-800/60 rounded-xl p-6 border border-dark-600">
                  <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🍎</span> iPhone (Safari)
                  </h3>
                  <ol className="space-y-3">
                    {[
                      'Abra o Pocket Wise no navegador Safari',
                      'Toque no botão de compartilhar (ícone de quadrado com seta para cima)',
                      'Role para baixo e toque em "Adicionar à Tela de Início"',
                      'Edite o nome se quiser e toque em "Adicionar"',
                      'Pronto! O app aparecerá na sua tela inicial como um app normal',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-300">
                        <span className="flex-shrink-0 w-7 h-7 bg-secondary-500/20 text-secondary-400 rounded-full flex items-center justify-center text-sm font-bold">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Preços Section */}
      <section id="precos" className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-800/50">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8">
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
                a: 'Perfeitamente! Design responsivo e pode ser instalado como app na tela inicial do seu celular.',
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-dark-800/50">
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
              <img
                src="/Logo_PocketWise.jpeg"
                alt="PocketWise"
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span className="text-xl font-bold text-gray-100">Pocket<span className="text-primary-500">Wise</span></span>
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
