import React, { useEffect, useState, useCallback } from 'react';
import {
  User,
  Phone,
  Wallet,
  Receipt,
  CalendarCheck,
  Copy,
  Check,
  Search,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  Building2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { chatwootWidgetApi, type ChatwootPartySummary } from './api/chatwootWidgetApi';
import { formatLocalDate } from '@/core/utils/dateUtils';
import { formatCurrency } from '@/core/utils';

export const ChatwootWidgetPage: React.FC = () => {
  const [phoneQuery, setPhoneQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ChatwootPartySummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // حالة نموذج إضافة وعد سداد سريع
  const [showPromiseForm, setShowPromiseForm] = useState(false);
  const [promiseAmount, setPromiseAmount] = useState('');
  const [promiseCurrency, setPromiseCurrency] = useState('YER');
  const [promiseDate, setPromiseDate] = useState(() => formatLocalDate());
  const [promiseNotes, setPromiseNotes] = useState('');
  const [isSubmittingPromise, setIsSubmittingPromise] = useState(false);
  const [promiseFeedback, setPromiseFeedback] = useState<string | null>(null);

  const fetchCustomer = useCallback(async (phone: string) => {
    if (!phone || phone.trim().length < 6) return;
    setIsLoading(true);
    setNotFound(false);
    try {
      const result = await chatwootWidgetApi.findPartyByPhone(phone);
      if (result) {
        setData(result);
        setPromiseCurrency(result.balances[0]?.currency_code || 'YER');
      } else {
        setData(null);
        setNotFound(true);
      }
    } catch {
      setData(null);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. قراءة المعاملات من الرابط (URL Search Params أو Hash)
  useEffect(() => {
    const searchStr = window.location.search || window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(searchStr);

    const initialPhone =
      params.get('phone') ||
      params.get('phone_number') ||
      params.get('contact[phone_number]') ||
      params.get('contact_phone');

    if (initialPhone) {
      setPhoneQuery(initialPhone);
      void fetchCustomer(initialPhone);
    }
  }, [fetchCustomer]);

  // 2. الاستماع لأحداث Chatwoot PostMessage في حال تم تمرير بيانات المحادثة
  useEffect(() => {
    const handleChatwootMessage = (event: MessageEvent) => {
      try {
        const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!payload) return;

        // دعم أحداث Chatwoot Dashboard App المعيارية
        const contact = payload.data?.contact || payload.contact;
        const incomingPhone = contact?.phone_number || contact?.phone;
        if (incomingPhone && typeof incomingPhone === 'string') {
          setPhoneQuery(incomingPhone);
          void fetchCustomer(incomingPhone);
        }
      } catch {
        // تجاهل أي رسائل غير متعلقة
      }
    };

    window.addEventListener('message', handleChatwootMessage);
    return () => window.removeEventListener('message', handleChatwootMessage);
  }, [fetchCustomer]);

  // نسخ ملخص الحساب للرد به على العميل داخل شات ووت بنقرة زر
  const handleCopySummary = () => {
    if (!data) return;
    const balanceLines =
      data.balances.length > 0
        ? data.balances.map(b => `${formatCurrency(b.balance)} ${b.currency_code}`).join(' و ')
        : 'لا توجد مديونية مسجلة';

    const text = `أهلاً بك أخي ${data.party.name}،
رصيد حسابك الحالي لدى مؤسسة الجعفري حتى تاريخ اليوم (${formatLocalDate()}):
💰 ${balanceLines}

شاكرين تعاونكم الدائم معنا 🌹`;

    void navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // إرسال وعد السداد السريع
  const handleAddPromise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !promiseAmount || Number(promiseAmount) <= 0) return;

    setIsSubmittingPromise(true);
    setPromiseFeedback(null);
    try {
      const res = await chatwootWidgetApi.recordPaymentPromise({
        companyId: data.party.company_id,
        partyId: data.party.id,
        amount: Number(promiseAmount),
        currencyCode: promiseCurrency,
        promiseDate,
        notes: promiseNotes.trim() || undefined,
      });

      if (res.success) {
        setPromiseFeedback('تم تسجيل وعد السداد بنجاح ✅');
        setShowPromiseForm(false);
        setPromiseAmount('');
        setPromiseNotes('');
        void fetchCustomer(data.party.phone || phoneQuery);
      } else {
        setPromiseFeedback(`فشل التسجيل: ${res.error || 'خطأ'}`);
      }
    } finally {
      setIsSubmittingPromise(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 font-sans text-slate-800 antialiased dark:bg-slate-900 dark:text-slate-100" dir="rtl">
      {/* الشريط العلوي للودجت */}
      <header className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Building2 size={16} />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-slate-800 dark:text-white">الزهراء ERP</h1>
            <p className="text-[10px] font-bold text-slate-400">بوابة خدمة العملاء (Chatwoot)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchCustomer(phoneQuery)}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          title="تحديث البيانات"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* حقل البحث السريع برقم الهاتف */}
      <div className="mb-3">
        <div className="relative">
          <input
            type="text"
            value={phoneQuery}
            onChange={e => setPhoneQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void fetchCustomer(phoneQuery);
            }}
            placeholder="ابحث برقم الهاتف أو الجوال..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pr-8 pl-8 text-xs font-bold text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            dir="ltr"
          />
          <Search size={14} className="pointer-events-none absolute top-2.5 right-2.5 text-slate-400" />
          {phoneQuery && (
            <button
              type="button"
              onClick={() => void fetchCustomer(phoneQuery)}
              className="absolute top-1.5 left-2 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              بحث
            </button>
          )}
        </div>
      </div>

      {/* حالة التحميل */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Loader2 size={24} className="animate-spin text-emerald-600" />
          <span className="mt-2 text-xs font-bold">جارٍ مطابقة العميل في المنظومة...</span>
        </div>
      )}

      {/* لم يتم العثور على العميل */}
      {!isLoading && notFound && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertCircle size={24} className="mx-auto text-amber-600 dark:text-amber-400" />
          <h2 className="mt-2 text-xs font-black text-amber-900 dark:text-amber-200">الرقم غير مسجل كعميل</h2>
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            لم يتم العثور على عميل أو مورد برقم ({phoneQuery}). يمكنك إضافته من المنظومة.
          </p>
          <a
            href="#/parties"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
          >
            <User size={13} />
            <span>إضافة عميل جديد</span>
          </a>
        </div>
      )}

      {/* محتوى بيانات العميل */}
      {!isLoading && data && (
        <div className="space-y-3">
          {/* بطاقة العميل الأساسية */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {data.party.type === 'customer' ? 'عميل' : data.party.type === 'supplier' ? 'مورد' : 'عميل ومورد'}
                </span>
                <h2 className="mt-1 text-sm font-black text-slate-800 dark:text-white">{data.party.name}</h2>
              </div>
              <a
                href={`#/parties`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                title="فتح ملف العميل في تبويب جديد"
              >
                <span>الملف</span>
                <ExternalLink size={11} />
              </a>
            </div>

            {data.party.phone && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                <Phone size={12} className="text-slate-400" />
                <span className="font-mono">{data.party.phone}</span>
              </div>
            )}
          </div>

          {/* بطاقة الأرصدة المالية */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Wallet size={14} className="text-emerald-600" />
                <span>الأرصدة الحالية</span>
              </div>
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200"
                title="نسخ كليشة الرد السريع لإرسالها للعميل في Chatwoot"
              >
                {copiedSummary ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{copiedSummary ? 'تم النسخ!' : 'نسخ للرد'}</span>
              </button>
            </div>

            {data.balances.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد حركات مالية مسجلة</p>
            ) : (
              <div className="space-y-1.5">
                {data.balances.map(b => {
                  const isDebit = b.balance > 0;
                  return (
                    <div
                      key={b.currency_code}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-900/60"
                    >
                      <span className="font-bold text-slate-600 dark:text-slate-400">{b.currency_code}</span>
                      <span
                        className={`font-mono font-black ${
                          isDebit
                            ? 'text-rose-600 dark:text-rose-400'
                            : b.balance < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500'
                        }`}
                        dir="ltr"
                      >
                        {formatCurrency(b.balance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* وعود السداد المعلقة */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <CalendarCheck size={14} className="text-indigo-600" />
                <span>وعود السداد</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPromiseForm(!showPromiseForm)}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <PlusCircle size={12} />
                <span>{showPromiseForm ? 'إلغاء' : 'إضافة وعد'}</span>
              </button>
            </div>

            {promiseFeedback && (
              <div className="mb-2 rounded-lg bg-emerald-50 p-2 text-center text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {promiseFeedback}
              </div>
            )}

            {/* نموذج إضافة وعد سداد سريع */}
            {showPromiseForm && (
              <form onSubmit={handleAddPromise} className="mb-3 space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5 dark:border-indigo-900/30 dark:bg-indigo-950/20">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">المبلغ</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={promiseAmount}
                      onChange={e => setPromiseAmount(e.target.value)}
                      placeholder="500"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">العملة</label>
                    <select
                      value={promiseCurrency}
                      onChange={e => setPromiseCurrency(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="YER">YER (ريال يمني)</option>
                      <option value="SAR">SAR (ريال سعودي)</option>
                      <option value="USD">USD (دولار)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">تاريخ الوعد</label>
                  <input
                    type="date"
                    required
                    value={promiseDate}
                    onChange={e => setPromiseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={promiseNotes}
                    onChange={e => setPromiseNotes(e.target.value)}
                    placeholder="ملاحظات العذر أو طريقة التحويل..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPromise}
                  className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSubmittingPromise ? 'جارٍ الحفظ...' : 'حفظ وعد السداد في ERP'}
                </button>
              </form>
            )}

            {data.pendingPromises.length === 0 ? (
              <p className="text-[11px] text-slate-400">لا توجد وعود سداد معلقة</p>
            ) : (
              <div className="space-y-1.5">
                {data.pendingPromises.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-900/60"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(p.amount)} {p.currency_code}
                      </span>
                      {p.notes && <p className="text-[10px] text-slate-400">{p.notes}</p>}
                    </div>
                    <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400" dir="ltr">
                      {p.promise_date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* آخر الفواتير */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/80">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Receipt size={14} className="text-amber-600" />
              <span>آخر الفواتير</span>
            </div>

            {data.recentInvoices.length === 0 ? (
              <p className="text-[11px] text-slate-400">لا توجد فواتير مسجلة</p>
            ) : (
              <div className="space-y-1.5">
                {data.recentInvoices.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-900/60"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        #{inv.invoice_number}
                      </span>
                      <span className="mr-2 text-[10px] text-slate-400 font-mono" dir="ltr">{inv.issue_date}</span>
                    </div>
                    <div className="text-left" dir="ltr">
                      <span className="font-mono font-black text-slate-700 dark:text-slate-300">
                        {formatCurrency(inv.total_amount)} {inv.currency_code}
                      </span>
                      {inv.remaining_amount > 0 && (
                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          متبقي: {formatCurrency(inv.remaining_amount)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatwootWidgetPage;
