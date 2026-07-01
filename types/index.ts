export type LicenseStatus = 'trial' | 'active' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'cancelled';
export type Niche = 'retail' | 'shipping' | 'restaurant' | 'hotel';

export interface Business {
  id: string;
  owner_name: string;
  business_name: string;
  email: string;
  phone?: string;
  address?: string;
  niche: Niche;
  logo_url?: string;
  is_admin?: boolean;
  trial_start_date: string;
  license_status: LicenseStatus;
  license_expiry_date?: string;
  created_at: string;
}

export interface Client {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
  total_debt: number;
  created_at: string;
}

export interface InvoiceItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  client_id?: string;
  client?: Client;
  invoice_number: string;
  invoice_year: number;
  niche_template: Niche;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes?: string;
  currency: string;
  metadata: {
    items?: InvoiceItem[];
    tracking_no?: string;
    origin?: string;
    destination?: string;
    weight_kg?: number;
    table_no?: string;
    covers?: number;
    room_no?: string;
    check_in?: string;
    check_out?: string;
    nights?: number;
  };
  created_at: string;
}

export interface Expense {
  id: string;
  business_id: string;
  category: string;
  description?: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

export interface DashboardMetrics {
  business_id: string;
  business_name: string;
  total_sales: number;
  total_investments: number;
  total_expenses: number;
  net_profit: number;
  total_receivables: number;
  license_status: LicenseStatus;
}  
