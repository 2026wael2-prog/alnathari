/**
 * PriorityQueueCard — طابور التحصيل التنفيذي كشبكة إكسل احترافية.
 *
 * ترقية مقصودة: كان الطابور قائمة `<ul>` للقراءة فقط، وصار شبكة ExcelTable
 * المعيارية في النظام (ترويسة مجمّدة، فرز، تحديد، نسخ TSV، تدقيق أعمدة محفوظ،
 * عرض كامل، ترقيم صفحات) فوقها طبقة عمل حقيقية:
 *   • فلترة متقدمة (بحث/درجة/تأخر/عملة/تصعيد/مسؤول/انقطاع تواصل).
 *   • عروض محفوظة (حرج / تأخر مطوّل / قابل للتذكير / منقطع التواصل).
 *   • إجراءات جماعية: إسناد المحدد لمحصّل عبر RPC، وتصدير المحدد.
 *   • تلوين حراري للدرجة والمبلغ وأيام التأخير + حصة كل صف من الطابور.
 *   • صف إجمالي وشريط حالة كإكسل، وتصدير xlsx منسّق (RTL + مجاميع).
 *
 * كل الترتيب والدرجة من الخادم (`get_debt_priority_queue`): الواجهة لا تملك
 * مبالغ موحّدة العملة ولا سجل التواصل، فلا يجوز أن تختلق ترتيباً محلياً.
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, Loader2, RotateCcw, X } from 'lucide-react';
import ExcelTable from '../../../ui/common/ExcelTable';
import type { Column } from '../../../ui/common/ExcelTable';
import { cn } from '../../../core/utils';
import { usePermission } from '../../../core/hooks/usePermission';
import { useCompany } from '../../settings/hooks';
import { useFeedbackStore } from '../../feedback/store';
import { useDebtCollectors, useDebtDashboard, useDebtPriorityQueue } from '../hooks/useDebtQueries';
import { useDebtMutations } from '../hooks/useDebtMutations';
import DebtQueryError from './DebtQueryError';
import { ReminderModal } from './ReminderModal';
import PromiseFormModal from './PromiseFormModal';
import { buildQueueColumns } from './queue/queueColumns';
import {
  QueueActionsCell,
  QueueAmountCell,
  QueuePartyCell,
  QueueScoreCell,
} from './queue/QueueCells';
import {
  QueueBulkBar,
  QueueFilterBar,
  QueuePresetsRow,
  QueueStatusBar,
} from './queue/QueueControls';
import { exportQueueToExcel } from '../lib/queueExcelExporter';
import {
  EMPTY_QUEUE_FILTERS,
  buildQueueFilterOptions,
  filterQueueRows,
  queueBucketLabel,
  queueRowId,
  summarizeQueue,
  type QueueFilterOptions,
  type QueueFilters,
  type QueueSavedView,
  type QueueSummary,
} from '../lib/queueGrid';
import type {
  DebtCollector,
  DebtPriorityQueueRow,
  DebtQueueBucket,
  FollowUpDashboardRow,
} from '../types';

/** سقف صفوف الطابور المطلوبة من الخادم (الخادم يقيّد الطلب بنفسه). */
const QUEUE_LIMIT = 200;
/** وضع التركيز: أعلى N مهمة فقط حين يريد المحصّل تنفيذاً سريعاً بلا تشتيت. */
const FOCUS_ROWS = 10;

const ghostButton =
  'inline-flex items-center gap-1 rounded-lg border border-[var(--app-border)] px-2 py-1 text-[11px] font-bold text-[var(--app-text-secondary)] transition-colors hover:border-blue-500/40 hover:text-blue-600';

interface HeaderProps {
  bucket: DebtQueueBucket;
  data: QueueData;
  handlers: QueueHandlers;
  onBucketChange: (bucket: DebtQueueBucket) => void;
}

/** ترويسة الطابور: البِكِت الحالي، وضع التركيز، والتحديث اليدوي. */
const QueueHeader: React.FC<HeaderProps> = ({ bucket, data, handlers, onBucketChange }) => (
  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2.5">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-bold text-[var(--app-text)]">طابور التحصيل بالأهمية</h3>
      <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">
        {queueBucketLabel(bucket)}
      </span>
      {bucket !== 'all' && (
        <button
          type="button"
          onClick={() => {
            onBucketChange('all');
          }}
          className={cn(ghostButton, 'hover:border-rose-500/40 hover:text-rose-600')}
          title="إلغاء فلتر البِكِت والعودة لكل المهام"
        >
          <X size={11} /> إلغاء الفلتر
        </button>
      )}
    </div>
    <div className="flex items-center gap-2">
      {data.query.isFetching ? <Loader2 size={13} className="animate-spin text-blue-600" /> : null}
      <button
        type="button"
        onClick={handlers.toggleFocus}
        aria-pressed={data.focusOnly}
        title={`إظهار أعلى ${String(FOCUS_ROWS)} مهمة فقط`}
        className={cn(
          ghostButton,
          data.focusOnly && 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300'
        )}
      >
        تركيز {FOCUS_ROWS}
      </button>
      <button type="button" onClick={handlers.refresh} className={ghostButton}>
        <RotateCcw size={11} /> تحديث
      </button>
    </div>
  </header>
);

interface MobileListProps {
  rows: DebtPriorityQueueRow[];
  canRemind: boolean;
  canManage: boolean;
  partiesWithDetail: ReadonlySet<string>;
  onRemind: (row: DebtPriorityQueueRow) => void;
  onPromise: (row: DebtPriorityQueueRow) => void;
}

/** نسخة الجوال (تحت md): نفس الخلايا لكن بلا شبكة عريضة. */
const QueueMobileList: React.FC<MobileListProps> = ({
  rows,
  canRemind,
  canManage,
  partiesWithDetail,
  onRemind,
  onPromise,
}) => (
  <ul className="divide-y divide-[var(--app-border)] md:hidden">
    {rows.map((row, index) => (
      <li key={row.task_id} className="flex items-start gap-2 px-3 py-2.5">
        <span className="w-4 pt-0.5 text-center font-mono text-[10px] font-bold text-[var(--app-text-secondary)]">
          {String(index + 1)}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <QueueScoreCell score={row.priority_score} drivers={row.score_drivers} />
            <QueuePartyCell row={row} />
          </div>
          <QueueAmountCell row={row} />
        </div>
        <QueueActionsCell
          row={row}
          canRemind={canRemind}
          canManage={canManage}
          hasDashboardRow={partiesWithDetail.has(row.party_id)}
          onRemind={onRemind}
          onPromise={onPromise}
        />
      </li>
    ))}
  </ul>
);

const baseCurrencyOf = (currency: string | undefined): string =>
  currency !== undefined && currency !== '' ? currency : 'SAR';

/** رتبة الأولوية من ترتيب الخادم — تُعرض حتى لو أعاد المستخدم فرز الأعمدة. */
const rankOf = (rows: DebtPriorityQueueRow[]): ReadonlyMap<string, number> =>
  new Map(rows.map((row, index) => [row.task_id, index + 1]));

/** وصف نصي للفلاتر المطبقة — يُكتب في ورقة Excel للتوثيق. */
const describeFilters = (filters: QueueFilters): string => {
  const parts: string[] = [];
  if (filters.search !== '') parts.push(`بحث: ${filters.search}`);
  if (filters.minScore > 0) parts.push(`درجة ≥ ${String(filters.minScore)}`);
  if (filters.minDaysLate > 0) parts.push(`تأخير ≥ ${String(filters.minDaysLate)} يوم`);
  if (filters.currency !== '') parts.push(`عملة ${filters.currency}`);
  if (filters.stage !== '') parts.push(`تصعيد ${filters.stage}`);
  if (filters.onlyPhone) parts.push('لهاتف');
  if (filters.onlyOverdue) parts.push('متأخر');
  if (filters.onlyStaleContact) parts.push('منقطع التواصل');
  return parts.length === 0 ? 'كل المهام' : parts.join(' • ');
};

/** شرح المعادلة في تفاصيل قابلة للطي (لا يأكل ارتفاع الشاشة). */
const QueueScoreFormula: React.FC = () => (
  <details className="group border-t border-[var(--app-border)] px-3 py-1.5 text-[10px] leading-relaxed text-[var(--app-text-secondary)]">
    <summary className="flex cursor-pointer list-none items-center gap-1 font-bold">
      <ChevronDown size={11} className="transition-transform group-open:rotate-180" />
      كيف تُحسب درجة الأهمية؟
    </summary>
    <p className="mt-1 max-w-4xl">
      الدرجة (0..100) = تخلّف زمني 40 + ثقل المبلغ بالعملة الأساسية 25 + وعد مكسور 20 + انقطاع
      التواصل 10 + مرحلة التصعيد 5. تُحسب على الخادم لأن الواجهة لا تملك مبالغ موحّدة العملة ولا
      سجل التواصل، لذا لا يُعاد ترتيب الصفوف محلياً عند تغيير الفرز — ويبقى عمود «أولوية» مرجعاً
      ثابتاً من الخادم.
    </p>
  </details>
);

interface QueueSelection {
  partiesWithDetail: ReadonlySet<string>;
  remindRow: DebtPriorityQueueRow | null;
  setRemindRow: (row: DebtPriorityQueueRow | null) => void;
  promiseRow: DebtPriorityQueueRow | null;
  setPromiseRow: (row: DebtPriorityQueueRow | null) => void;
  /** ReminderModal يستهلك صف لوحة المتابعة (رصيد + تصنيف + آخر تذكير). */
  reminderTarget: FollowUpDashboardRow | null;
}

/** حالة اختيار الصف + اشتقاق ما تحتاجه النوافذ (تذكير/وعد) من لوحة المتابعة. */
const useQueueSelection = (dashboardRows: FollowUpDashboardRow[] | undefined): QueueSelection => {
  const [remindRow, setRemindRow] = useState<DebtPriorityQueueRow | null>(null);
  const [promiseRow, setPromiseRow] = useState<DebtPriorityQueueRow | null>(null);

  const reminderTarget = useMemo<FollowUpDashboardRow | null>(() => {
    if (remindRow === null) return null;
    return (dashboardRows ?? []).find(row => row.party_id === remindRow.party_id) ?? null;
  }, [dashboardRows, remindRow]);

  const partiesWithDetail = useMemo(
    () => new Set((dashboardRows ?? []).map(row => row.party_id)),
    [dashboardRows]
  );

  return { partiesWithDetail, remindRow, setRemindRow, promiseRow, setPromiseRow, reminderTarget };
};

const QueueModals: React.FC<{ selection: QueueSelection }> = ({ selection }) => (
  <>
    {selection.reminderTarget !== null && (
      <ReminderModal
        isOpen
        onClose={() => {
          selection.setRemindRow(null);
        }}
        row={selection.reminderTarget}
      />
    )}
    <PromiseFormModal
      isOpen={selection.promiseRow !== null}
      onClose={() => {
        selection.setPromiseRow(null);
      }}
      partyId={selection.promiseRow?.party_id ?? null}
      partyName={selection.promiseRow?.party_name ?? null}
    />
  </>
);

interface QueueExportController {
  isExporting: boolean;
  runExport: (rows: DebtPriorityQueueRow[]) => void;
}

/** تصدير xlsx منسّق مع حالة تحميل ورسالة فشل واضحة (لا فشل صامت). */
const useQueueExport = (
  baseCurrency: string,
  bucket: DebtQueueBucket,
  filters: QueueFilters,
  companyName: string
): QueueExportController => {
  const { showToast } = useFeedbackStore();
  const [isExporting, setIsExporting] = useState(false);
  const runExport = (exportRows: DebtPriorityQueueRow[]): void => {
    if (exportRows.length === 0) {
      showToast('لا توجد صفوف مطابقة للتصدير', 'info');
      return;
    }
    setIsExporting(true);
    void exportQueueToExcel(exportRows, {
      companyName,
      bucketLabel: queueBucketLabel(bucket),
      baseCurrency,
      filtersLabel: describeFilters(filters),
    })
      .catch(() => {
        showToast('تعذّر إنشاء ملف Excel — أعد المحاولة', 'error');
      })
      .finally(() => {
        setIsExporting(false);
      });
  };
  return { isExporting, runExport };
};

interface QueueDataState {
  query: ReturnType<typeof useDebtPriorityQueue>;
  rows: DebtPriorityQueueRow[];
  filters: QueueFilters;
  setFilters: React.Dispatch<React.SetStateAction<QueueFilters>>;
  focusOnly: boolean;
  setFocusOnly: React.Dispatch<React.SetStateAction<boolean>>;
  visible: DebtPriorityQueueRow[];
  options: QueueFilterOptions;
  summary: QueueSummary;
}

/** بيانات الطابور + حالة الفلترة (بحث/درجة/عملة/تصعيد/مسؤول/مفاتيح). */
const useQueueData = (bucket: DebtQueueBucket): QueueDataState => {
  const query = useDebtPriorityQueue(bucket, QUEUE_LIMIT);
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_QUEUE_FILTERS);
  const [focusOnly, setFocusOnly] = useState(false);
  const filtered = useMemo(() => filterQueueRows(rows, filters), [rows, filters]);
  const visible = useMemo(
    () => (focusOnly ? filtered.slice(0, FOCUS_ROWS) : filtered),
    [filtered, focusOnly]
  );
  const options = useMemo(() => buildQueueFilterOptions(rows), [rows]);
  const summary = useMemo(() => summarizeQueue(visible), [visible]);
  return { query, rows, filters, setFilters, focusOnly, setFocusOnly, visible, options, summary };
};

type QueueData = QueueDataState;

interface GridProps {
  data: QueueData;
  columns: Array<Column<DebtPriorityQueueRow>>;
  baseCurrency: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  canRemind: boolean;
  canManage: boolean;
  selection: QueueSelection;
  onRetry: () => void;
  onExport: () => void;
}

interface DesktopGridProps {
  data: QueueData;
  columns: Array<Column<DebtPriorityQueueRow>>;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onExport: () => void;
}

/** شبكة سطح المكتب: ExcelTable المعيارية بكل ميزات الجدول الاحترافي. */
const QueueDesktopGrid: React.FC<DesktopGridProps> = ({
  data,
  columns,
  selectedIds,
  onSelectionChange,
  onExport,
}) => (
  <div className="hidden min-h-[420px] flex-col md:flex">
    <ExcelTable
      columns={columns}
      data={data.visible}
      title="طابور التحصيل"
      resizeStorageKey="debts_priority_queue_cols"
      colorTheme="blue"
      isRTL
      showSearch={false}
      enableSelection
      enableResize
      enablePagination
      pageSize={25}
      isLoading={data.query.isLoading}
      emptyMessage="لا توجد مهام مطابقة للفلاتر الحالية"
      getRowId={queueRowId}
      selectedRowIds={selectedIds}
      onSelectionChange={onSelectionChange}
      onExport={onExport}
    />
  </div>
);

/** منطقة العرض: شبكة سطح المكتب + قائمة الجوال + شريط الحالة. */
const QueueGridArea: React.FC<GridProps> = ({
  data,
  columns,
  baseCurrency,
  selectedIds,
  onSelectionChange,
  canRemind,
  canManage,
  selection,
  onRetry,
  onExport,
}) => {
  if (data.query.isError) {
    return (
      <div className="p-3">
        <DebtQueryError
          message="تعذّر جلب طابور التحصيل المرتّب، فأُخفي بدل عرض ترتيب غير حقيقي."
          onRetry={onRetry}
        />
      </div>
    );
  }
  return (
    <>
      <QueueDesktopGrid
        data={data}
        columns={columns}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
        onExport={onExport}
      />
      <QueueMobileList
        rows={data.visible}
        canRemind={canRemind}
        canManage={canManage}
        partiesWithDetail={selection.partiesWithDetail}
        onRemind={selection.setRemindRow}
        onPromise={selection.setPromiseRow}
      />
      <QueueStatusBar
        summary={data.summary}
        baseCurrency={baseCurrency}
        totalRows={data.rows.length}
        selectedCount={selectedIds.size}
      />
    </>
  );
};

interface ColumnsContext {
  data: QueueData;
  baseCurrency: string;
  canRemind: boolean;
  canManage: boolean;
  selection: QueueSelection;
}

/** يبني الأعمدة مرة واحدة لكل تغيير مؤثر (صفوف/فلترة/صلاحيات). */
const useQueueColumns = ({
  data,
  baseCurrency,
  canRemind,
  canManage,
  selection,
}: ColumnsContext): Array<Column<DebtPriorityQueueRow>> => {
  const rankById = useMemo(() => rankOf(data.rows), [data.rows]);
  const { partiesWithDetail, setRemindRow, setPromiseRow } = selection;
  return useMemo(
    () =>
      buildQueueColumns({
        rows: data.visible,
        baseCurrency,
        rankById,
        canRemind,
        canManage,
        partiesWithDetail,
        onRemind: setRemindRow,
        onPromise: setPromiseRow,
      }),
    [
      data.visible,
      baseCurrency,
      rankById,
      canRemind,
      canManage,
      partiesWithDetail,
      setRemindRow,
      setPromiseRow,
    ]
  );
};

interface QueueHandlers {
  toggleFocus: () => void;
  refresh: () => void;
  patchFilters: (change: Partial<QueueFilters>) => void;
  applyView: (view: QueueSavedView) => void;
  clearFilters: () => void;
  clearSelection: () => void;
  handleAssign: (collectorId: string) => void;
  exportSelected: () => void;
  exportVisible: () => void;
}

interface HandlersContext {
  data: QueueData;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  assignParties: ReturnType<typeof useDebtMutations>['assignParties'];
  exporter: QueueExportController;
}

/** كل معالجات الطابور في مكان واحد — يبقى المكوّن الرئيسي تركيباً صرفاً. */
const useQueueHandlers = ({
  data,
  selectedIds,
  setSelectedIds,
  assignParties,
  exporter,
}: HandlersContext): QueueHandlers => {
  const selectedRows = (): DebtPriorityQueueRow[] =>
    data.rows.filter(row => selectedIds.has(row.task_id));
  const handleAssign = (collectorId: string): void => {
    if (selectedIds.size === 0) return;
    const partyIds = [...new Set(selectedRows().map(row => row.party_id))];
    assignParties(
      { partyIds, collectorId },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
        },
      }
    );
  };
  return {
    toggleFocus: () => {
      data.setFocusOnly(value => !value);
    },
    refresh: () => {
      void data.query.refetch();
    },
    patchFilters: (change: Partial<QueueFilters>) => {
      data.setFilters(previous => ({ ...previous, ...change }));
    },
    applyView: (view: QueueSavedView) => {
      data.setFilters(view.filters);
      setSelectedIds(new Set());
    },
    clearFilters: () => {
      data.setFilters(EMPTY_QUEUE_FILTERS);
    },
    clearSelection: () => {
      setSelectedIds(new Set());
    },
    handleAssign,
    exportSelected: () => {
      exporter.runExport(selectedRows());
    },
    exportVisible: () => {
      exporter.runExport(data.visible);
    },
  };
};

interface BulkAreaProps {
  selectedIds: Set<string>;
  collectors: DebtCollector[];
  isAssigning: boolean;
  handlers: QueueHandlers;
}

/** شريط الإجراءات الجماعية — لا يُرسم إلا عند وجود تحديد فعلي. */
const QueueBulkArea: React.FC<BulkAreaProps> = ({ selectedIds, collectors, isAssigning, handlers }) => {
  if (selectedIds.size === 0) return null;
  return (
    <QueueBulkBar
      selectedCount={selectedIds.size}
      collectors={collectors}
      isAssigning={isAssigning}
      onAssign={handlers.handleAssign}
      onExport={handlers.exportSelected}
      onClear={handlers.clearSelection}
    />
  );
};

export interface PriorityQueueCardProps {
  bucket: DebtQueueBucket;
  onBucketChange: (bucket: DebtQueueBucket) => void;
}

/**
 * طابور التحصيل التنفيذي: كل صف يحمل درجة أهميته وسببها والأمر التالي، مع
 * إجراءات مباشرة (تذكير / وعد / فتح الملف) وإجراءات جماعية على المحدد.
 */
export const PriorityQueueCard: React.FC<PriorityQueueCardProps> = ({ bucket, onBucketChange }) => {
  const data = useQueueData(bucket);
  const { data: dashboardRows } = useDebtDashboard();
  const { data: collectors } = useDebtCollectors();
  const { data: company } = useCompany();
  const { assignParties, isSaving } = useDebtMutations();
  const selection = useQueueSelection(dashboardRows);
  const { hasPermission: canRemind } = usePermission('debts:remind');
  const { hasPermission: canManage } = usePermission('debts:manage');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set<string>());
  const baseCurrency = baseCurrencyOf(company?.base_currency);
  const exporter = useQueueExport(baseCurrency, bucket, data.filters, company?.name_ar ?? '');
  const columns = useQueueColumns({ data, baseCurrency, canRemind, canManage, selection });
  const handlers = useQueueHandlers({ data, selectedIds, setSelectedIds, assignParties, exporter });
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm">
      <QueueHeader bucket={bucket} data={data} handlers={handlers} onBucketChange={onBucketChange} />
      <QueueFilterBar filters={data.filters} options={data.options} onChange={handlers.patchFilters} />
      <QueuePresetsRow
        filters={data.filters}
        isExporting={exporter.isExporting}
        onApply={handlers.applyView}
        onClear={handlers.clearFilters}
      />
      <QueueBulkArea
        selectedIds={selectedIds}
        collectors={collectors ?? []}
        isAssigning={isSaving}
        handlers={handlers}
      />
      <QueueGridArea
        data={data}
        columns={columns}
        baseCurrency={baseCurrency}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        canRemind={canRemind}
        canManage={canManage}
        selection={selection}
        onRetry={handlers.refresh}
        onExport={handlers.exportVisible}
      />
      <QueueScoreFormula />
      <QueueModals selection={selection} />
    </section>
  );
};

export default PriorityQueueCard;
