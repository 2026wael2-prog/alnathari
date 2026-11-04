/**
 * إدارة نموذج جرد المخزون: مزامنة النموذج ↔ جلسة العمل ↔ الخادم.
 *
 * سبب وجود الملف: كانت هذه الكتلة (~130 سطراً: `useForm`، ثلاث `useEffect`
 * للمزامنة، حساب `displayItems`، بناء `prepareProgressItems`، والحفظ عند مغادرة
 * الصفحة) مكتوبة داخل `AuditSessionPage` فرفعت حجمها وتعقيدها فوق حدود المشروع.
 *
 * إصلاح مهم (العيب B4 في تقرير التدقيق): كان `watchedItems` يُقرأ بـ
 * `getValues('items')` **أثناء الرسم**، و`getValues` لا يشترك في تغييرات النموذج،
 * فكان الجدول يعرض لقطة قديمة بعد أول تعديل. الآن `useWatch` يعيد الرسم عند كل
 * تغيير فعلي في مصفوفة الأصناف.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch, type UseFormRegister, type UseFormReturn } from 'react-hook-form';
import { computeItemsSignature } from '../utils/auditProgressSignature';

export interface AuditFormValues {
  items: Array<Record<string, unknown>>;
}

export interface UseAuditSessionFormOptions {
  /** أصناف الجلسة كما وصلت من الخادم. */
  serverItems: Array<Record<string, unknown>>;
  /** أصناف المسودة المحلية (sessionStorage/الخادم). */
  sessionItems: Array<Record<string, unknown>>;
  isCompleted: boolean;
  isRestoring: boolean;
  updateItems: (items: Array<Record<string, unknown>>) => void;
  mergeWithServer: (items: Array<Record<string, unknown>>) => void;
}

export interface UseAuditSessionFormReturn {
  register: UseFormRegister<AuditFormValues>;
  getValues: UseFormReturn<AuditFormValues>['getValues'];
  reset: UseFormReturn<AuditFormValues>['reset'];
  /** الأصناف المعروضة في الجدول (تتفاعل مع تعديلات المستخدم). */
  displayItems: Array<Record<string, unknown>>;
  /** يُستدعى بعد أي تعديل مباشر على النموذج لتحديث البصمة والمسودة. */
  syncItemsMutation: (items: Array<Record<string, unknown>>) => void;
  /** بصمة آخر مزامنة (لتفادي الحفظ المتكرر). */
  lastSyncedRef: React.RefObject<string>;
}

const FORM_DEFAULTS: AuditFormValues = { items: [] };

/** يدمج كميات المسودة المحلية على أصناف الخادم (المحلي أولاً لأنه أحدث). */
const mergeDraftQuantities = (
  serverItems: Array<Record<string, unknown>>,
  sessionItems: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  if (sessionItems.length === 0) return serverItems;

  return serverItems.map(serverItem => {
    const serverProductId = serverItem.product_id ?? serverItem.id;
    const local = sessionItems.find(item => (item.product_id ?? item.id) === serverProductId);
    const localCounted = local?.counted_quantity;
    return localCounted !== null && localCounted !== undefined
      ? { ...serverItem, counted_quantity: localCounted }
      : serverItem;
  });
};

/** يزامن النموذج مع ثلاث مصادر: البذرة الأولى، المسودة المحلية، وتحديثات الخادم. */
const useItemsSynchronization = ({
  serverItems,
  sessionItems,
  isCompleted,
  isRestoring,
  mergeWithServer,
  reset,
  lastSyncedRef,
}: {
  serverItems: Array<Record<string, unknown>>;
  sessionItems: Array<Record<string, unknown>>;
  isCompleted: boolean;
  isRestoring: boolean;
  mergeWithServer: (items: Array<Record<string, unknown>>) => void;
  reset: UseFormReturn<AuditFormValues>['reset'];
  lastSyncedRef: React.RefObject<string>;
}): void => {
  const hasLoadedServerItemsRef = useRef(false);

  useEffect(() => {
    if (serverItems.length === 0 || hasLoadedServerItemsRef.current) return;
    hasLoadedServerItemsRef.current = true;
    const itemsToReset = mergeDraftQuantities(serverItems, sessionItems);
    lastSyncedRef.current = computeItemsSignature(itemsToReset);
    reset({ items: itemsToReset });
  }, [serverItems, sessionItems, reset, lastSyncedRef]);

  useEffect(() => {
    if (isCompleted || sessionItems.length === 0) return;
    const serialized = computeItemsSignature(sessionItems);
    if (serialized === lastSyncedRef.current) return;
    lastSyncedRef.current = serialized;
    reset({ items: sessionItems });
  }, [sessionItems, isCompleted, reset, lastSyncedRef]);

  useEffect(() => {
    if (isCompleted || isRestoring || serverItems.length === 0) return;
    if (!hasLoadedServerItemsRef.current) return;
    mergeWithServer(serverItems);
  }, [serverItems, isCompleted, isRestoring, mergeWithServer]);
};

export const useAuditSessionForm = ({
  serverItems,
  sessionItems,
  isCompleted,
  isRestoring,
  updateItems,
  mergeWithServer,
}: UseAuditSessionFormOptions): UseAuditSessionFormReturn => {
  const { register, reset, getValues, control } = useForm<AuditFormValues>({
    defaultValues: FORM_DEFAULTS,
    shouldUnregister: false,
  });
  const lastSyncedRef = useRef<string>('');

  useItemsSynchronization({
    serverItems,
    sessionItems,
    isCompleted,
    isRestoring,
    mergeWithServer,
    reset,
    lastSyncedRef,
  });

  const watchedItems = useWatch({ control, name: 'items' });

  const displayItems = useMemo(() => {
    if (isCompleted) return serverItems;
    return sessionItems.length > 0 ? sessionItems : watchedItems;
  }, [isCompleted, serverItems, sessionItems, watchedItems]);

  const syncItemsMutation = useCallback(
    (items: Array<Record<string, unknown>>): void => {
      lastSyncedRef.current = computeItemsSignature(items);
      reset({ items });
      updateItems(items);
    },
    [reset, updateItems]
  );

  return { register, getValues, reset, displayItems, syncItemsMutation, lastSyncedRef };
};
