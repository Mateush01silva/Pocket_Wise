import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/layout/Layout'
import {
  Dashboard,
  Transactions,
  CreditCards,
  Budgets,
  Projections,
  Family,
  Settings,
} from './pages'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/credit-cards" element={<CreditCards />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/projections" element={<Projections />} />
          <Route path="/family" element={<Family />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" theme="dark" richColors />
    </BrowserRouter>
  )
}

export default App
