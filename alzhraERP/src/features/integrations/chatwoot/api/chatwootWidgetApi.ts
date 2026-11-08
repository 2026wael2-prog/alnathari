import { supabase } from '@/core/api/supabaseClient';
import type { Database } from '@/core/database.types';

export interface ChatwootPartySummary {
  party: {
    id: string;
    company_id: string;
    name: string;
    phone: string | null;
    type: string;
    tax_number: string | null;
    credit_limit: number | null;
  };
  balances: {
    currency_code: string;
    balance: number;
  }[];
  recentInvoices: {
    id: string;
    invoice_number: string;
    issue_date: string;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    currency_code: string;
    status: string;
  }[];
  pendingPromises: {
    id: string;
    amount: number;
    currency_code: string;
    promise_date: string;
    status: string;
    notes: string | null;
  }[];
}

export const chatwootWidgetApi = {
  /**
   * البحث عن الطرف (عميل أو مورد) بمطابقة رقم الهاتف (آخر 9 أرقام)
   */
  async findPartyByPhone(rawPhone: string): Promise<ChatwootPartySummary | null> {
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
    if (!cleanDigits || cleanDigits.length < 6) return null;
    const clean9 = cleanDigits.slice(-9);

    const { data: matched, error: partyError } = await supabase
      .from('parties')
      .select('id, company_id, name, phone, type, tax_number, credit_limit')
      .is('deleted_at', null)
      .ilike('phone', `%${clean9}%`)
      .limit(1);

    if (partyError || !matched || matched.length === 0) {
      return null;
    }

    const party = matched[0];

    // 1. الأرصدة بجميع العملات
    const { data: balancesData } = await supabase.rpc('get_party_all_balances', {
      p_company_id: party.company_id,
      p_party_id: party.id,
    });

    const balances = Array.isArray(balancesData) ? balancesData : [];

    // 2. آخر الفواتير الصادرة
    const { data: invoicesData } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, total_amount, paid_amount, remaining_amount, currency_code, status')
      .eq('customer_id', party.id)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })
      .limit(3);

    const recentInvoices = (invoicesData || []).map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      total_amount: Number(inv.total_amount || 0),
      paid_amount: Number(inv.paid_amount || 0),
      remaining_amount: Number(inv.remaining_amount || 0),
      currency_code: inv.currency_code || 'YER',
      status: inv.status || 'posted',
    }));

    // 3. وعود السداد المعلقة
    const { data: promisesData } = await supabase
      .from('debt_payment_promises')
      .select('id, amount, currency_code, promise_date, status, notes')
      .eq('party_id', party.id)
      .eq('status', 'pending')
      .order('promise_date', { ascending: true })
      .limit(3);

    const pendingPromises = (promisesData || []).map(p => ({
      id: p.id,
      amount: Number(p.amount || 0),
      currency_code: p.currency_code,
      promise_date: p.promise_date,
      status: p.status,
      notes: p.notes,
    }));

    return {
      party: {
        id: party.id,
        company_id: party.company_id,
        name: party.name,
        phone: party.phone,
        type: party.type,
        tax_number: party.tax_number,
        credit_limit: party.credit_limit,
      },
      balances,
      recentInvoices,
      pendingPromises,
    };
  },

  /**
   * تسجيل وعد سداد سريع من داخل ودجت شات ووت
   */
  async recordPaymentPromise(params: {
    companyId: string;
    partyId: string;
    amount: number;
    currencyCode: string;
    promiseDate: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      type PromiseInsert = Database['public']['Tables']['debt_payment_promises']['Insert'];
      const payload: PromiseInsert = {
        company_id: params.companyId,
        party_id: params.partyId,
        amount: params.amount,
        currency_code: params.currencyCode,
        promise_date: params.promiseDate,
        notes: params.notes || 'وعد سداد مسجل عبر ودجت خدمة العملاء Chatwoot',
        status: 'pending',
      };

      const { error } = await supabase.from('debt_payment_promises').insert(payload);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
};
