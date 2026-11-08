import { supabase } from '@/lib/supabaseClient';
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
   * البحث عن الطرف (عميل أو مورد) برقم الهاتف أو الاسم
   */
  async findParty(query: string): Promise<ChatwootPartySummary | null> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return null;

    const cleanDigits = trimmed.replace(/[^0-9]/g, '');
    let queryBuilder = supabase
      .from('parties')
      .select('id, company_id, name, phone, type, tax_number, credit_limit')
      .is('deleted_at', null);

    if (cleanDigits.length >= 6) {
      const clean9 = cleanDigits.slice(-9);
      queryBuilder = queryBuilder.or(`phone.ilike.%${clean9}%,name.ilike.%${trimmed}%`);
    } else {
      queryBuilder = queryBuilder.ilike('name', `%${trimmed}%`);
    }

    const { data: matched, error: partyError } = await queryBuilder.limit(1);

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
      .select('id, invoice_number, issue_date, total_amount, paid_amount, currency_code, status')
      .eq('party_id', party.id)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })
      .limit(3);

    const recentInvoices = (invoicesData || []).map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number || '',
      issue_date: inv.issue_date,
      total_amount: Number(inv.total_amount || 0),
      paid_amount: Number(inv.paid_amount || 0),
      remaining_amount: Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)),
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
      party,
      balances,
      recentInvoices,
      pendingPromises,
    };
  },

  /**
   * توافقية مع الاستدعاء برقم الهاتف فقط
   */
  findPartyByPhone(rawPhone: string): Promise<ChatwootPartySummary | null> {
    return this.findParty(rawPhone);
  },

  /**
   * جلب قائمة سريعة بأحدث العملاء للاختيار السريع
   */
  async getRecentParties(): Promise<{ id: string; name: string; phone: string | null; type: string }[]> {
    const { data } = await supabase
      .from('parties')
      .select('id, name, phone, type')
      .is('deleted_at', null)
      .not('phone', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(6);

    return data || [];
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
    notes?: string | undefined;
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

