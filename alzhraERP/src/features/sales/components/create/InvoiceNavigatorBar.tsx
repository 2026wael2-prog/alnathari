/* eslint-disable max-lines-per-function */
import React, { useState, useEffect } from 'react';
import {
  ChevronsRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  PlusCircle,
  Search,
  Eye,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import type { UseInvoiceNavigationResult } from '../../hooks/useInvoiceNavigation';

interface InvoiceNavigatorBarProps {
  navigation: UseInvoiceNavigationResult;
  defaultNextNumber?: string | undefined;
  onNewInvoiceClick?: () => void;
}

export const InvoiceNavigatorBar: React.FC<InvoiceNavigatorBarProps> = ({
  navigation,
  defaultNextNumber,
  onNewInvoiceClick,
}) => {
  const {
    currentViewingInvoice,
    canGoFirst,
    canGoPrev,
    canGoNext,
    canGoLast,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    jumpToInvoiceNumber,
    exitViewingMode,
    isNavigating,
  } = navigation;

  const [inputVal, setInputVal] = useState<string>('');

  // مزامنة مربع الإدخال مع رقم الفاتورة الحالية أو التالية
  useEffect(() => {
    if (currentViewingInvoice) {
      setInputVal(currentViewingInvoice.invoice_number);
    } else if (defaultNextNumber !== undefined && defaultNextNumber.length > 0) {
      setInputVal(defaultNextNumber);
    } else {
      setInputVal('');
    }
  }, [currentViewingInvoice, defaultNextNumber]);

  const handleSearchSubmit = (e: React.SyntheticEvent): void => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    void jumpToInvoiceNumber(inputVal.trim());
  };

  const handleNewInvoice = (): void => {
    exitViewingMode();
    if (onNewInvoiceClick) {
      onNewInvoiceClick();
    }
  };

  const isViewingPrevious = Boolean(currentViewingInvoice);

  return (
    <div className="sticky bottom-2 z-30 mx-auto w-full max-w-5xl px-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300/80 bg-white/95 p-2 shadow-lg backdrop-blur-md transition-all dark:border-slate-700/80 dark:bg-slate-900/95">
        {/* أزرار التنقل VCR على طريقة برنامج الميزان */}
        <div className="flex items-center gap-1">
          {/* الفاتورة الأولى (|◀) */}
          <button
            type="button"
            onClick={goToFirst}
            disabled={!canGoFirst || isNavigating}
            title="الفاتورة الأولى (|◀)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronsRight size={18} />
          </button>

          {/* الفاتورة السابقة (◀) */}
          <button
            type="button"
            onClick={goToPrev}
            disabled={!canGoPrev || isNavigating}
            title="الفاتورة السابقة (◀)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronRight size={18} />
          </button>

          {/* مربع إدخال رقم الفاتورة والقفز المباشر */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              value={inputVal}
              onChange={e => {
                setInputVal(e.target.value);
              }}
              placeholder="رقم الفاتورة..."
              className="h-9 w-32 rounded-lg border border-slate-300 bg-white px-2.5 text-center font-mono text-xs font-bold text-slate-900 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:w-44"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={isNavigating || !inputVal.trim()}
              title="الانتقال إلى رقم الفاتورة"
              className="absolute left-1 flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-30"
            >
              {isNavigating ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            </button>
          </form>

          {/* الفاتورة التالية (▶) */}
          <button
            type="button"
            onClick={goToNext}
            disabled={!canGoNext || isNavigating}
            title="الفاتورة التالية (▶)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronLeft size={18} />
          </button>

          {/* الفاتورة الأخيرة (▶|) */}
          <button
            type="button"
            onClick={goToLast}
            disabled={!canGoLast || isNavigating}
            title="الفاتورة الأخيرة (▶|)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        {/* المؤشر والوضع الحالي */}
        <div className="flex items-center gap-2">
          {isViewingPrevious ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
              <Eye size={14} className="text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold">
                معاينة فاتورة سابقة: {currentViewingInvoice?.invoice_number}
              </span>
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 sm:flex">
              <FileSpreadsheet size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold">تحرير فاتورة جديدة</span>
            </div>
          )}

          {/* زر فتح فاتورة جديدة */}
          <button
            type="button"
            onClick={handleNewInvoice}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            <PlusCircle size={16} />
            <span className="text-xs font-bold">فاتورة جديدة</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceNavigatorBar;
