export type TransactionType = 'income' | 'expense' | 'personal';

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export type InvoiceType = 'official' | 'settlement';

export interface User {
  id: number;
  name: string;
  fullName?: string;
  pin?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  userId?: number | string; // only for personal transactions
  date: string; // ISO8601
  invoiceId?: string; // if auto-created from invoice payment
}

export interface Invoice {
  id: string;
  clientName: string;
  description: string;
  amount: number;
  type: InvoiceType;
  status: InvoiceStatus;
  createdAt: string;
  paidAt?: string;
}

export interface Settlement {
  id: string;
  fromUserId: number;
  toUserId: number;
  amount: number;
  note?: string;
  date: string;
}

export interface DBData {
  users: User[];
  transactions: Transaction[];
  invoices: Invoice[];
  settlements: Settlement[];
}

export interface FounderBalance {
  userId: number;
  name: string;
  totalIncome: number;
  totalSharedExpenses: number;
  totalPersonalWithdrawals: number;
  settlementsReceived: number;
  settlementsPaid: number;
  balance: number;
}

export interface SessionUser {
  id: number;
  name: string;
  fullName: string;
  backendUserId?: string;
  username?: string;
}
