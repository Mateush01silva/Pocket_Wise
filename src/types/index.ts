// User & Family types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  familyId?: string
  createdAt: Date
}

export interface Family {
  id: string
  name: string
  members: User[]
  createdAt: Date
}

// Transaction types
export type TransactionType = 'income' | 'expense'
export type TransactionCategory =
  | 'salary'
  | 'investment'
  | 'other-income'
  | 'food'
  | 'transport'
  | 'housing'
  | 'utilities'
  | 'entertainment'
  | 'healthcare'
  | 'education'
  | 'shopping'
  | 'other-expense'

export interface Transaction {
  id: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description: string
  date: Date
  userId: string
  familyId?: string
  isRecurring: boolean
  recurringConfig?: RecurringConfig
  createdAt: Date
  updatedAt: Date
}

export interface RecurringConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number // Every X days/weeks/months/years
  endDate?: Date
  nextOccurrence: Date
}

// Credit Card types
export interface CreditCard {
  id: string
  name: string
  lastDigits: string
  limit: number
  closingDay: number // Day of month
  dueDay: number // Day of month
  color: string
  userId: string
  familyId?: string
  createdAt: Date
}

export interface CreditCardTransaction {
  id: string
  creditCardId: string
  amount: number
  description: string
  category: TransactionCategory
  purchaseDate: Date
  installments: number
  currentInstallment: number
  userId: string
  familyId?: string
  createdAt: Date
}

// Budget types
export interface Budget {
  id: string
  category: TransactionCategory
  amount: number
  period: 'monthly' | 'yearly'
  familyId?: string
  userId: string
  createdAt: Date
}

// Dashboard types
export interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  balance: number
  savingsRate: number
  monthlyProjection: number
}

export interface CategorySpending {
  category: TransactionCategory
  amount: number
  percentage: number
}

// Subscription types (for SaaS billing)
export interface Subscription {
  id: string
  userId: string
  plan: 'free' | 'premium' | 'family'
  status: 'active' | 'canceled' | 'past_due'
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}
