/**
 * حفظ تقدّم الجرد: بناء طلب الحفظ + الحفظ الدوري + الحفظ الإجباري عند المغادرة.
 *
 * سبب وجود الملف: كان هذا الجزء داخل `useAuditSessionForm` فجعل الهوك الواحد
 * يتجاوز حدّ طول الدالة في ESLint. فصل «مزامنة النموذج» عن «حفظ التقدّم» يجعل
 * كل مسؤولية قابلة للاختبار وحدها.
 */
import { useCallback, useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { inventoryService } from '../service';
import { computeItemsSignature } from '../utils/auditProgressSignature';
import type { AuditFormValues } from './useAuditSessionForm';

/** صنف واحد في طلب حفظ تقدّم الجرد. */
export interface AuditProgressItem {
  id?: string;
  product_id: string;
  counted_quantity: number | null;
}

export interface UseAuditProgressPersistenceOptions {
  sessionId: string | undefined;
  isCompleted: boolean;
  getValues: UseFormReturn<AuditFormValues>['getValues'];
  displayItems: Array<Record<string, unknown>>;
  serverItems: Array<Record<string, unknown>>;
  updateItems: (items: Array<Record<string, unknown>>) => void;
  lastSyncedRef: React.RefObject<string>;
}

export interface UseAuditProgressPersistenceReturn {
  prepareProgressItems: () => AuditProgressItem[];
  handleSaveProgress: () => void;
}

/** معرّف الصنف النصّي بلا تحويل ضمني لكائنات (`[object Object]`). */
const identifierOf = (item: Record<string, unknown>): string => {
  const primary = item.product_id;
  if (typeof primary === 'string') return primary;
  if (typeof primary === 'number') return String(primary);
  const fallback = item.id;
  if (typeof fallback === 'string') return fallback;
  if (typeof fallback === 'number') return String(fallback);
  return '';
};

/** يحوّل قيمة كمية إلى رقم (أو null عند الفراغ/عدم الصلاحية). */
const toCountedQuantity = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

/** يبني طلب الحفظ من النموذج (أحدث قيمة) مع الرجوع لأصناف المصدر عند غيابها. */
const buildProgressItems = (
  formItems: Array<Record<string, unknown>>,
  sourceList: Array<Record<string, unknown>>
): AuditProgressItem[] =>
  sourceList.map(item => {
    const productId = identifierOf(item);
    const matched = formItems.find(formItem => identifierOf(formItem) === productId);
    const formValue = matched?.counted_quantity;
    const rawCounted =
      formValue !== undefined && formValue !== '' ? formValue : item.counted_quantity;

    const result: AuditProgressItem = {
      product_id: productId,
      counted_quantity: toCountedQuantity(rawCounted),
    };
    if (typeof item.id === 'string' && item.id.length > 0) result.id = item.id;
    return result;
  });

export const useAuditProgressPersistence = ({
  sessionId,
  isCompleted,
  getValues,
  displayItems,
  serverItems,
  updateItems,
  lastSyncedRef,
}: UseAuditProgressPersistenceOptions): UseAuditProgressPersistenceReturn => {
  const prepareProgressItems = useCallback((): AuditProgressItem[] => {
    const sourceList = displayItems.length > 0 ? displayItems : serverItems;
    return buildProgressItems(getValues('items'), sourceList);
  }, [displayItems, serverItems, getValues]);

  const handleSaveProgress = useCallback((): void => {
    if (isCompleted) return;
    const formItems = getValues('items');
    if (formItems.length === 0) return;
    const serialized = computeItemsSignature(formItems);
    if (serialized === lastSyncedRef.current) return;
    lastSyncedRef.current = serialized;
    updateItems(formItems);
  }, [getValues, isCompleted, updateItems, lastSyncedRef]);

  // حفظ إجباري عند إغلاق المتصفح أو مغادرة الصفحة داخل التطبيق (SPA).
  useEffect(() => {
    if (isCompleted) return undefined;

    const persist = (toServer: boolean): void => {
      const formItems = getValues('items');
      if (formItems.length === 0) return;
      updateItems(formItems);
      if (!toServer || sessionId === undefined) return;
      const itemsToSave = prepareProgressItems();
      if (itemsToSave.length === 0) return;
      void inventoryService.saveAuditProgress({ sessionId, items: itemsToSave });
    };

    const onBeforeUnload = (): void => {
      persist(false);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return (): void => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      persist(true);
    };
  }, [getValues, isCompleted, updateItems, sessionId, prepareProgressItems]);

  return { prepareProgressItems, handleSaveProgress };
};
