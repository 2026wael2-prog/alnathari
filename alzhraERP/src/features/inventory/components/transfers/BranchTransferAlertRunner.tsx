/* eslint-disable max-lines-per-function, @typescript-eslint/strict-boolean-expressions */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useBranchFilter } from '@/features/branches/hooks/useBranchFilter';
import { useStockTransferRequests, type StockTransferRequest } from '../../hooks/useStockTransferRequests';
import { useBranchTransferSubscription } from '../../hooks/useBranchTransferSubscription';
import { IncomingTransferApprovalModal } from './IncomingTransferApprovalModal';
import { TransferDispatchedNotificationModal } from './TransferDispatchedNotificationModal';

export const BranchTransferAlertRunner: React.FC = () => {
  const { user } = useAuthStore();
  const companyId = user?.company_id;
  const { branchId } = useBranchFilter();

  const [activeIncomingRequest, setActiveIncomingRequest] = useState<StockTransferRequest | null>(null);
  const [activeDispatchedRequest, setActiveDispatchedRequest] = useState<StockTransferRequest | null>(null);

  // تتبع المعرفات التي تم تنبيه المستخدم بها لمنع التكرار المزعج في نفس الجلسة
  const notifiedIncomingIdsRef = useRef<Set<string>>(new Set());
  const notifiedDispatchedIdsRef = useRef<Set<string>>(new Set());

  // جلب الطلبات الواردة المعلقة لفرع المستخدم الحالي
  const { data: requests, refetch } = useStockTransferRequests('all', branchId);

  const handleRealtimeUpdate = useCallback(() => {
    void refetch();
  }, [refetch]);

  // الاشتراك اللحظي في Supabase Realtime عبر هوك الطبقة الخدمية
  useBranchTransferSubscription(companyId, branchId, handleRealtimeUpdate);

  // 1. التحقق من الطلبات الواردة المعلقة وتنبيه الفرع المصدر فوراً
  useEffect(() => {
    if (!branchId || !requests || requests.length === 0) return;

    // البحث عن أحدث طلب وارد معلق موجه لهذا الفرع ولم يسبق إظهار نافذته
    const pendingIncoming = requests.find(
      r => r.source_branch_id === branchId && r.status === 'pending' && !notifiedIncomingIdsRef.current.has(r.id)
    );

    if (pendingIncoming && !activeIncomingRequest) {
      notifiedIncomingIdsRef.current.add(pendingIncoming.id);
      setActiveIncomingRequest(pendingIncoming);
    }

    // البحث عن أحدث طلب مكتمل أو معالج للفرع الطالب لإشعاره
    const justResolved = requests.find(
      r =>
        r.requester_branch_id === branchId &&
        (r.status === 'completed' || r.status === 'rejected') &&
        !notifiedDispatchedIdsRef.current.has(r.id)
    );

    // نتحقق من حداثة الطلب (تم تحديثه في آخر 10 دقائق مثلاً)
    if (justResolved && !activeDispatchedRequest) {
      const updatedAt = new Date(justResolved.updated_at).getTime();
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      if (updatedAt > tenMinutesAgo) {
        notifiedDispatchedIdsRef.current.add(justResolved.id);
        setActiveDispatchedRequest(justResolved);
      }
    }
  }, [requests, branchId, activeIncomingRequest, activeDispatchedRequest]);

  // 2. مؤقت فحص دوري كل 25 ثانية (Smart Fallback Polling) لضمان عدم تفويت أي طلب
  useEffect(() => {
    if (!companyId || !branchId) return;

    const timer = setInterval(() => {
      void refetch();
    }, 25000);

    return () => {
      clearInterval(timer);
    };
  }, [companyId, branchId, refetch]);

  return (
    <>
      {/* النافذة المنبثقة للفرع المطلوب منه: مراجعة والموافقة وتحديد الكميات والإرسال */}
      <IncomingTransferApprovalModal
        request={activeIncomingRequest}
        isOpen={Boolean(activeIncomingRequest)}
        onClose={() => {
          setActiveIncomingRequest(null);
        }}
      />

      {/* النافذة المنبثقة للفرع الطالب: إشعار بأن البضاعة تم شحنها واعتمادها بنجاح */}
      <TransferDispatchedNotificationModal
        request={activeDispatchedRequest}
        isOpen={Boolean(activeDispatchedRequest)}
        onClose={() => {
          setActiveDispatchedRequest(null);
        }}
        onViewTransfers={() => {
          window.location.hash = '#/inventory';
        }}
      />
    </>
  );
};

export default BranchTransferAlertRunner;

