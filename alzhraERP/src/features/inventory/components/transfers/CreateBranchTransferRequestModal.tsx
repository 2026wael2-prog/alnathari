/* eslint-disable max-lines-per-function, complexity, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unnecessary-condition, jsx-a11y/label-has-associated-control, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  X,
  Package,
  Search,
  Send,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useCreateStockTransferRequest } from '../../hooks/useStockTransferRequests';
import { useProducts } from '../../hooks/useProducts';
import { useBranchFilter } from '@/features/branches/hooks/useBranchFilter';
import { useBranches } from '@/features/settings/hooks';
import type { Branch } from '@/features/settings/types';
import type { Product } from '../../types';

interface CreateBranchTransferRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateBranchTransferRequestModal: React.FC<CreateBranchTransferRequestModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { branchId: currentBranchId, branchName: currentBranchName } = useBranchFilter();
  const { data: allBranches } = useBranches();
  const { products } = useProducts('');
  const { mutate: createRequest, isPending } = useCreateStockTransferRequest();

  const otherBranches = useMemo(() => {
    return ((allBranches as Branch[]) ?? []).filter((b: Branch) => b.id !== currentBranchId);
  }, [allBranches, currentBranchId]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');

  // ضبط الفرع الافتراضي
  React.useEffect(() => {
    if (otherBranches.length > 0 && !selectedBranchId) {
      const first = otherBranches[0];
      if (first) {
        setSelectedBranchId(first.id);
      }
    }
  }, [otherBranches, selectedBranchId]);

  if (!isOpen) return null;

  const filteredProducts = (products ?? []).filter(p => {
    if (!productSearch.trim()) return false;
    const term = productSearch.toLowerCase();
    return (
      p.name_ar.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.part_number?.toLowerCase().includes(term) ?? false)
    );
  }).slice(0, 8);

  const parsedQty = Number(quantity);
  const isValid = Boolean(
    selectedBranchId &&
    selectedProduct &&
    !isNaN(parsedQty) &&
    parsedQty > 0
  );

  const handleSubmit = (e: React.SyntheticEvent): void => {
    e.preventDefault();
    if (!isValid || !selectedProduct || !currentBranchId) return;

    createRequest(
      {
        requesterBranchId: currentBranchId,
        dto: {
          sourceBranchId: selectedBranchId,
          productId: selectedProduct.id,
          quantity: parsedQty,
          notes: notes.trim() ? notes.trim() : undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
          setSelectedProduct(null);
          setProductSearch('');
          setQuantity('1');
          setNotes('');
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
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900">
        
        {/* الترويسة */}
        <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                طلب مناقلة بضاعة من فرع آخر
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                طلب شحن قطع وأصناف من مستودع فرع شقيق إلى {currentBranchName ?? 'فرعك'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* النموذج */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5 text-right">
          
          {/* اختيار الفرع المصدر */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الفرع المطلوب منه البضاعة (المصدر):
            </label>
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={e => {
                  setSelectedBranchId(e.target.value);
                }}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {otherBranches.map((b: Branch) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* البحث عن المنتج */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الصنف أو القطعة المطلوبة:
            </label>

            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/60 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedProduct.name_ar}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      كود: {selectedProduct.sku}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="pointer-events-none absolute right-3 top-3 text-slate-400">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                  }}
                  placeholder="ابحث باسم الصنف، الباركود، أو رقم القطعة..."
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />

                {/* قائمة النتائج السريعة */}
                {filteredProducts.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setProductSearch('');
                        }}
                        className="flex cursor-pointer items-center justify-between border-b border-slate-100 p-2 text-xs transition hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {p.name_ar}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {p.sku}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* الكمية المطلوبة */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الكمية المطلوبة:
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => {
                setQuantity(e.target.value);
              }}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* الملاحظات */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات الطلب (اختياري):
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => {
                setNotes(e.target.value);
              }}
              placeholder="مثلاً: مطلوب عاجل لزبون في الورشة..."
              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/* تنبيه توضيحي */}
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <AlertCircle size={15} className="shrink-0" />
            <span>
              بمجرد الإرسال، ستظهر رسالة منبثقة تفاعلية فورية على شاشة الفرع المصدر للموافقة والإرسال.
            </span>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="h-9 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!isValid || isPending}
              className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-xs font-bold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              <span>إرسال طلب المناقلة الآن</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default CreateBranchTransferRequestModal;

