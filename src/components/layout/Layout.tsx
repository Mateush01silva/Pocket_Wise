import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { NotificationBell } from '../NotificationBell'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Overlay para mobile quando sidebar está aberta */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
        {/* Header fixo com botão hambúrguer e notificações */}
        <div className="fixed top-4 left-4 right-4 z-30 flex items-center justify-between lg:left-auto lg:right-8">
          {/* Botão hambúrguer para mobile */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isSidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Notificações */}
          <NotificationBell />
        </div>

        <div className="max-w-7xl mx-auto pt-14 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
