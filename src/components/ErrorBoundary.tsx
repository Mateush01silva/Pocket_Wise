import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-dark-800 border border-red-500/30 rounded-lg p-8">
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              Algo deu errado
            </h1>
            <p className="text-gray-300 mb-4">
              Ocorreu um erro ao carregar a aplicação. Por favor, recarregue a página.
            </p>
            <div className="bg-dark-900 rounded p-4 mb-4">
              <p className="text-sm font-mono text-red-300 mb-2">
                {this.state.error?.toString()}
              </p>
              {this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-sm text-gray-400 cursor-pointer">
                    Stack trace
                  </summary>
                  <pre className="text-xs text-gray-500 mt-2 overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
