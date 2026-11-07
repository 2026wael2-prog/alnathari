/* eslint-disable max-lines-per-function, complexity, jsx-a11y/label-has-associated-control, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Package,
  XCircle,
  X,
  Building2,
  Calendar,
  AlertTriangle,
  Loader2,
  Send,
} from 'lucide-react';
import type { StockTransferRequest } from '../../hooks/useStockTransferRequests';
import { useRespondToTransferRequest } from '../../hooks/useStockTransferRequests';

interface IncomingTransferApprovalModalProps {
  request: StockTransferRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export const IncomingTransferApprovalModal: React.FC<IncomingTransferApprovalModalProps> = ({
  request,
  isOpen,
  onClose,
}) => {
  const [approvedQty, setApprovedQty] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const { mutate: respond, isPending } = useRespondToTransferRequest();

  // ضبط الكمية الأولية عند فتح الطلب
  React.useEffect(() => {
    if (request) {
      setApprovedQty(String(request.requested_quantity));
      setReviewNotes('');
      setIsRejecting(false);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const parsedApproved = Number(approvedQty);
  const isValidApproveQty = !isNaN(parsedApproved) && parsedApproved > 0;

  const handleApproveAndDispatch = (): void => {
    if (!isValidApproveQty) return;
    respond(
      {
        requestId: request.id,
        action: 'approve',
        approvedQuantity: parsedApproved,
        reviewNotes: reviewNotes.trim() ? reviewNotes.trim() : undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleReject = (): void => {
    respond(
      {
        requestId: request.id,
        action: 'reject',
        reviewNotes: reviewNotes.trim() ? reviewNotes.trim() : 'اعتذار عن عدم توفر الكمية المطلوبة حالياً',
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* خلفية معتمة بزجاج ناعم */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* بطاقة النافذة المنبثقة التفاعلية */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        
        {/* الترويسة بلون مميز لطلبات المناقلة العاجلة */}
        <div className="flex items-center justify-between border-b border-amber-200/80 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent p-4 dark:border-amber-800/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <ArrowRightLeft size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  طلب مناقلة بضاعة عاجل
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                  وارد جديد
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                فرع آخر يطلب تزويده ببضاعة من مستودعك
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* جسم النافذة */}
        <div className="space-y-4 p-5 text-right">
          {/* بيانات الفرع الطالب وتاريخ الطلب */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
            <div>
              <span className="text-[11px] text-slate-400">الفرع الطالب:</span>
              <div className="mt-0.5 flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                <Building2 size={13} className="text-blue-600" />
                <span>{request.requester_branch_name ?? 'فرع شقيق'}</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">تاريخ ووقت الطلب:</span>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono font-medium text-slate-600 dark:text-slate-300">
                <Calendar size={13} className="text-slate-400" />
                <span>
                  {new Date(request.created_at).toLocaleTimeString('ar-YE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* تفاصيل المنتج والكمية المطلوبة */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                  <Package size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {request.product_name ?? 'منتج غير محدد'}
                  </h4>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    كود: {request.product_sku ?? '-'}
                  </span>
                </div>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400">الكمية المطلوبة:</span>
                <div className="font-mono text-base font-black text-blue-700 dark:text-blue-300">
                  {request.requested_quantity} <span className="text-[10px]">حبة</span>
                </div>
              </div>
            </div>

            {Boolean(request.notes) && (
              <div className="mt-2.5 border-t border-blue-200/60 pt-2 text-xs text-slate-600 dark:border-blue-900/60 dark:text-slate-300">
                <span className="font-bold text-slate-700 dark:text-slate-200">ملاحظة الطالب: </span>
                <span>{request.notes}</span>
              </div>
            )}
          </div>

          {/* تحديد الكمية المرسلة والموافقة */}
          {!isRejecting ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الكمية المعتمدة للإرسال الفعلي:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={approvedQty}
                    onChange={e => {
                      setApprovedQty(e.target.value);
                    }}
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-center font-mono text-sm font-black text-slate-900 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                  <span className="text-xs font-bold text-slate-500">قطعة</span>
                </div>
                {parsedApproved !== request.requested_quantity && isValidApproveQty && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={12} />
                    <span>تنبيه: الكمية المعتمدة تختلف عن الكمية الأصلية المطلوبة</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات الإرسال / الشحن (اختياري):
                </label>
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={e => {
                    setReviewNotes(e.target.value);
                  }}
                  placeholder="مثلاً: تم التسليم مع السائق عبده / تم الشحن فوراً..."
                  className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
              <label className="block text-xs font-bold text-rose-800 dark:text-rose-200">
                سبب الرفض والاعتذار:
              </label>
              <textarea
                value={reviewNotes}
                onChange={e => {
                  setReviewNotes(e.target.value);
                }}
                rows={2}
                placeholder="اكتب سبب عدم إمكانية إرسال البضاعة حالياً..."
                className="w-full rounded-lg border border-rose-300 bg-white p-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-rose-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
          )}
        </div>

        {/* أزرار الإجراءات في أسفل النافذة */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          {!isRejecting ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRejecting(true);
                }}
                disabled={isPending}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 active:scale-95 disabled:opacity-40 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400"
              >
                <XCircle size={15} />
                <span>اعتذار / رفض</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  لاحقاً
                </button>
                <button
                  type="button"
                  onClick={handleApproveAndDispatch}
                  disabled={!isValidApproveQty || isPending}
                  className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>موافقة وإرسال إلى الفرع</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejecting(false);
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isPending}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-md hover:bg-rose-700 active:scale-95 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                <span>تأكيد رفض الطلب</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default IncomingTransferApprovalModal;

