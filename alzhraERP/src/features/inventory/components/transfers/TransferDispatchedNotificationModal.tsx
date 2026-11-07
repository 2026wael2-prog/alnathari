/* eslint-disable max-lines-per-function, complexity, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Package,
  Building2,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { StockTransferRequest } from '../../hooks/useStockTransferRequests';

interface TransferDispatchedNotificationModalProps {
  request: StockTransferRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onViewTransfers?: () => void;
}

export const TransferDispatchedNotificationModal: React.FC<TransferDispatchedNotificationModalProps> = ({
  request,
  isOpen,
  onClose,
  onViewTransfers,
}) => {
  if (!isOpen || !request) return null;

  const isApproved = request.status === 'completed' || request.status === 'approved';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        
        {/* الترويسة بلون الحالة */}
        <div
          className={`flex items-center justify-between border-b p-4 ${
            isApproved
              ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40'
              : 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md ${
                isApproved ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-rose-600 shadow-rose-600/30'
              }`}
            >
              {isApproved ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isApproved ? 'تم إرسال المناقلة بنجاح!' : 'تحديث على طلب المناقلة'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isApproved
                  ? 'تمت الموافقة من الفرع المصدر وشحن البضاعة'
                  : 'اعتذر الفرع المصدر عن تلبية الطلب'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* محتوى الإشعار والتفاصيل */}
        <div className="space-y-3 p-5 text-right">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">الفرع المصدر:</span>
              <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                <Building2 size={13} className="text-blue-600" />
                {request.source_branch_name ?? 'الفرع المصدر'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400">المنتج:</span>
              <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                <Package size={13} className="text-emerald-600" />
                {request.product_name ?? 'صنف'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
              <span className="text-[11px] text-slate-400">الكمية:</span>
              <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                {request.requested_quantity} حبة
              </span>
            </div>
          </div>

          {Boolean(request.review_notes) && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              <span className="font-bold text-slate-700 dark:text-slate-200">ملاحظات الفرع: </span>
              <span>{request.review_notes}</span>
            </div>
          )}

          {isApproved && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                تم تسجيل حركة المخزون بنجاح وخصم الكمية من الفرع المصدر وإضافتها لمستودع فرعكم.
              </span>
            </div>
          )}
        </div>

        {/* الأزرار */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          {onViewTransfers && isApproved && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewTransfers();
              }}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>سجل المناقلات</span>
              <ArrowRight size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-sm transition active:scale-95 ${
              isApproved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            حسناً، فهمت
          </button>
        </div>

      </div>
    </div>
  );
};

export default TransferDispatchedNotificationModal;

