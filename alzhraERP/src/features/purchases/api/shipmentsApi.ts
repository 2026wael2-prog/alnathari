/* eslint-disable @typescript-eslint/no-unnecessary-type-conversion, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/only-throw-error, max-params */
import { supabase } from '../../../lib/supabaseClient';
import { formatLocalDate } from '../../../core/utils/dateUtils';
import { logger } from '../../../core/utils/logger';
import type {
  PurchaseQuotationShipment,
  ShipmentTimelineEvent,
  ShipmentTrackingStage,
  UpsertShipmentDTO,
} from '../types/shipment';

interface DynamicQueryBuilder {
  select: (columns?: string) => DynamicQueryBuilder;
  insert: (values: unknown) => DynamicQueryBuilder;
  update: (values: unknown) => DynamicQueryBuilder;
  delete: () => DynamicQueryBuilder;
  eq: (column: string, value: unknown) => DynamicQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => DynamicQueryBuilder;
  single: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  maybeSingle: () => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
  then: <TResult1 = { data: unknown; error: { code?: string; message?: string } | null }>(
    onfulfilled?: (value: { data: unknown; error: { code?: string; message?: string } | null }) => TResult1 | PromiseLike<TResult1>
  ) => Promise<TResult1>;
}

interface DynamicSupabaseClient {
  from: (table: string) => DynamicQueryBuilder;
}

const db = supabase as unknown as DynamicSupabaseClient;

interface RawShipmentRow {
  id: string;
  company_id: string;
  quotation_id: string;
  shipping_company_name: string;
  shipping_office_phone: string | null;
  shipping_office_address: string | null;
  waybill_number: string;
  origin_city: string;
  origin_hub: string | null;
  destination_city: string;
  destination_hub: string | null;
  destination_branch_id: string | null;
  destination_warehouse_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate_number: string | null;
  vehicle_type: string | null;
  parcel_count: number;
  weight_kg: number;
  cargo_description: string | null;
  shipping_cost: number;
  shipping_currency: string;
  payment_method: string;
  shipping_date: string;
  expected_arrival_date: string;
  actual_arrival_date: string | null;
  received_date: string | null;
  received_by: string | null;
  tracking_status: string;
  timeline: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  quotation?: {
    quotation_number: string;
    party?: { name: string } | null;
  } | null;
}

const mapRowToShipment = (row: RawShipmentRow): PurchaseQuotationShipment => {
  let timeline: ShipmentTimelineEvent[] = [];
  if (Array.isArray(row.timeline)) {
    timeline = row.timeline as ShipmentTimelineEvent[];
  } else if (typeof row.timeline === 'string') {
    try {
      const parsed = JSON.parse(row.timeline) as unknown;
      if (Array.isArray(parsed)) timeline = parsed as ShipmentTimelineEvent[];
    } catch {
      timeline = [];
    }
  }

  return {
    id: row.id,
    company_id: row.company_id,
    quotation_id: row.quotation_id,
    quotation_number: row.quotation?.quotation_number,
    supplier_name: row.quotation?.party?.name,
    shipping_company_name: row.shipping_company_name,
    shipping_office_phone: row.shipping_office_phone ?? '',
    shipping_office_address: row.shipping_office_address ?? '',
    waybill_number: row.waybill_number,
    origin_city: row.origin_city,
    origin_hub: row.origin_hub ?? undefined,
    destination_city: row.destination_city,
    destination_hub: row.destination_hub ?? undefined,
    destination_branch_id: row.destination_branch_id,
    destination_warehouse_id: row.destination_warehouse_id,
    driver_name: row.driver_name ?? '',
    driver_phone: row.driver_phone ?? '',
    vehicle_plate_number: row.vehicle_plate_number ?? '',
    vehicle_type: row.vehicle_type ?? 'شاحنة نقل / دينا',
    parcel_count: Number(row.parcel_count) || 1,
    weight_kg: Number(row.weight_kg) || 0,
    cargo_description: row.cargo_description ?? '',
    shipping_cost: Number(row.shipping_cost) || 0,
    shipping_currency: row.shipping_currency || 'YER',
    payment_method: (row.payment_method as PurchaseQuotationShipment['payment_method']) || 'collect_on_delivery',
    shipping_date: row.shipping_date,
    expected_arrival_date: row.expected_arrival_date,
    actual_arrival_date: row.actual_arrival_date,
    received_date: row.received_date,
    received_by: row.received_by ?? undefined,
    tracking_status: (row.tracking_status as ShipmentTrackingStage) || 'pending_dispatch',
    timeline,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? undefined,
  };
};

/** محاولة استخراج الشحنة من حقل delivery_terms أو notes لعرض السعر في حال عدم وجود الجدول */
const fallbackFromQuotation = async (
  quotationId: string,
  companyId: string
): Promise<PurchaseQuotationShipment | null> => {
  try {
    const { data, error } = await supabase
      .from('quotations')
      .select('id, company_id, quotation_number, delivery_terms, notes, party:parties(name), created_at')
      .eq('id', quotationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error !== null || data === null) return null;

    if (data.delivery_terms && data.delivery_terms.includes('__shipment_meta__:')) {
      const jsonStr = data.delivery_terms.split('__shipment_meta__:')[1];
      const parsed = JSON.parse(jsonStr) as PurchaseQuotationShipment;
      parsed.quotation_number = data.quotation_number;
      parsed.supplier_name = (data.party as { name?: string } | null)?.name;
      return parsed;
    }
  } catch (err) {
    logger.warn('shipmentsApi', 'fallbackFromQuotation parsing failed', err);
  }
  return null;
};

export const shipmentsApi = {
  /**
   * جلب تفاصيل شحنة عرض سعر معين
   */
  getShipmentByQuotationId: async (
    quotationId: string,
    companyId: string
  ): Promise<PurchaseQuotationShipment | null> => {
    try {
      const { data, error } = await db
        .from('purchase_quotation_shipments')
        .select('*, quotation:quotations(quotation_number, party:parties(name))')
        .eq('quotation_id', quotationId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (error !== null) {
        // إذا كان الخطأ أن الجدول غير موجود بعد (42P01)
        if (error.code === '42P01') {
          return await fallbackFromQuotation(quotationId, companyId);
        }
        logger.error('shipmentsApi', 'Error fetching quotation shipment:', error);
        return null;
      }

      if (data === null) return null;
      return mapRowToShipment(data as unknown as RawShipmentRow);
    } catch {
      return await fallbackFromQuotation(quotationId, companyId);
    }
  },

  /**
   * جلب قائمة جميع الشحنات للمنشأة (مع إمكانية تصفية الحالة)
   */
  getCompanyShipments: async (
    companyId: string,
    filterStage?: ShipmentTrackingStage
  ): Promise<PurchaseQuotationShipment[]> => {
    try {
      let query = db
        .from('purchase_quotation_shipments')
        .select('*, quotation:quotations(quotation_number, party:parties(name))')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (filterStage !== undefined && filterStage !== ('all' as unknown)) {
        query = query.eq('tracking_status', filterStage);
      }

      const { data, error } = await query;
      if (error !== null) {
        if (error.code === '42P01') {
          return [];
        }
        logger.error('shipmentsApi', 'Error fetching company shipments:', error);
        return [];
      }

      return (data as unknown as RawShipmentRow[]).map(mapRowToShipment);
    } catch (err) {
      logger.error('shipmentsApi', 'Failed to load company shipments:', err);
      return [];
    }
  },

  /**
   * إضافة أو تحديث بيانات الشحنة البرية لعرض سعر
   */
  upsertShipment: async (
    companyId: string,
    userId: string,
    dto: UpsertShipmentDTO
  ): Promise<PurchaseQuotationShipment> => {
    const today = formatLocalDate(new Date());

    // 1. التحقق من وجود شحنة مسبقة لمعرفة سجل التتبع (timeline)
    let existingTimeline: ShipmentTimelineEvent[] = [];
    let currentId = dto.id;

    if (!currentId) {
      const existing = await shipmentsApi.getShipmentByQuotationId(dto.quotation_id, companyId);
      if (existing !== null) {
        currentId = existing.id;
        existingTimeline = existing.timeline || [];
      }
    }

    const currentStage: ShipmentTrackingStage = dto.tracking_status || 'handed_to_office';
    const nowIso = new Date().toISOString();

    const updatedTimeline = [...existingTimeline];
    if (dto.timelineEvent) {
      updatedTimeline.push({
        id: crypto.randomUUID(),
        stage: dto.timelineEvent.stage,
        timestamp: nowIso,
        location: dto.timelineEvent.location,
        note: dto.timelineEvent.note,
        updatedBy: userId,
      });
    } else if (existingTimeline.length === 0) {
      updatedTimeline.push({
        id: crypto.randomUUID(),
        stage: currentStage,
        timestamp: nowIso,
        location: dto.origin_city || 'صنعاء',
        note: `تم قيد الشحنة برقم بوليصة (${dto.waybill_number}) عبر ${dto.shipping_company_name}`,
        updatedBy: userId,
      });
    }

    const payload = {
      company_id: companyId,
      quotation_id: dto.quotation_id,
      shipping_company_name: dto.shipping_company_name,
      shipping_office_phone: dto.shipping_office_phone || null,
      shipping_office_address: dto.shipping_office_address || null,
      waybill_number: dto.waybill_number,
      origin_city: dto.origin_city || 'صنعاء',
      origin_hub: dto.origin_hub || null,
      destination_city: dto.destination_city || 'المهرة (الغيضة)',
      destination_hub: dto.destination_hub || null,
      destination_branch_id: dto.destination_branch_id || null,
      destination_warehouse_id: dto.destination_warehouse_id || null,
      driver_name: dto.driver_name || null,
      driver_phone: dto.driver_phone || null,
      vehicle_plate_number: dto.vehicle_plate_number || null,
      vehicle_type: dto.vehicle_type || 'شاحنة نقل / دينا',
      parcel_count: dto.parcel_count || 1,
      weight_kg: dto.weight_kg || 0,
      cargo_description: dto.cargo_description || 'قطع غيار سيارات',
      shipping_cost: dto.shipping_cost || 0,
      shipping_currency: dto.shipping_currency || 'YER',
      payment_method: dto.payment_method || 'collect_on_delivery',
      shipping_date: dto.shipping_date || today,
      expected_arrival_date: dto.expected_arrival_date || today,
      actual_arrival_date: dto.actual_arrival_date || null,
      received_date: dto.received_date || null,
      received_by: dto.received_by || null,
      tracking_status: currentStage,
      timeline: updatedTimeline,
      notes: dto.notes || null,
      updated_at: nowIso,
      created_by: userId,
    };

    try {
      let resultRow: RawShipmentRow | null = null;

      if (currentId) {
        const { data, error } = await db
          .from('purchase_quotation_shipments')
          .update(payload)
          .eq('id', currentId)
          .eq('company_id', companyId)
          .select('*, quotation:quotations(quotation_number, party:parties(name))')
          .single();

        if (error !== null) throw error;
        resultRow = data as unknown as RawShipmentRow;
      } else {
        const { data, error } = await db
          .from('purchase_quotation_shipments')
          .insert({ ...payload, id: crypto.randomUUID() })
          .select('*, quotation:quotations(quotation_number, party:parties(name))')
          .single();

        if (error !== null) throw error;
        resultRow = data as unknown as RawShipmentRow;
      }

      return mapRowToShipment(resultRow);
    } catch (dbErr: unknown) {
      logger.warn('shipmentsApi', 'Direct DB insert/update failed, utilizing fallback mode', dbErr);
      
      // حفظ احتياطي في delivery_terms لعرض السعر حتى لا يتعطل العمل
      const fallbackShipment: PurchaseQuotationShipment = {
        id: currentId || crypto.randomUUID(),
        ...payload,
        origin_hub: payload.origin_hub ?? undefined,
        destination_hub: payload.destination_hub ?? undefined,
        notes: payload.notes ?? undefined,
        created_by: payload.created_by ?? undefined,
        received_by: payload.received_by ?? undefined,
        parcel_count: payload.parcel_count,
        weight_kg: payload.weight_kg,
        cargo_description: payload.cargo_description || '',
        shipping_cost: payload.shipping_cost,
        shipping_currency: payload.shipping_currency,
        payment_method: payload.payment_method as PurchaseQuotationShipment['payment_method'],
        shipping_office_phone: payload.shipping_office_phone || '',
        shipping_office_address: payload.shipping_office_address || '',
        driver_name: payload.driver_name || '',
        driver_phone: payload.driver_phone || '',
        vehicle_plate_number: payload.vehicle_plate_number || '',
        vehicle_type: payload.vehicle_type,
        created_at: nowIso,
        updated_at: nowIso,
      };

      try {
        const fallbackTerm = `شحن عبر ${dto.shipping_company_name} بوليصة: ${dto.waybill_number} __shipment_meta__:${JSON.stringify(fallbackShipment)}`;
        await supabase
          .from('quotations')
          .update({ delivery_terms: fallbackTerm })
          .eq('id', dto.quotation_id)
          .eq('company_id', companyId);
      } catch (termErr) {
        logger.error('shipmentsApi', 'Failed saving fallback terms:', termErr);
      }

      return fallbackShipment;
    }
  },

  /**
   * تحديث سريع لمحطة التتبع وحالة الشحنة البرية
   */
  updateTrackingStage: async (
    companyId: string,
    shipmentId: string,
    quotationId: string,
    stage: ShipmentTrackingStage,
    location: string,
    note: string,
    updatedBy?: string
  ): Promise<PurchaseQuotationShipment | null> => {
    const today = formatLocalDate(new Date());
    const nowIso = new Date().toISOString();

    const newEvent: ShipmentTimelineEvent = {
      id: crypto.randomUUID(),
      stage,
      timestamp: nowIso,
      location,
      note,
      updatedBy,
    };

    const current = await shipmentsApi.getShipmentByQuotationId(quotationId, companyId);
    const timeline = current !== null ? [...current.timeline, newEvent] : [newEvent];

    const updates: Record<string, unknown> = {
      tracking_status: stage,
      timeline,
      updated_at: nowIso,
    };

    if (stage === 'arrived_at_office') {
      updates.actual_arrival_date = today;
    } else if (stage === 'received_at_warehouse') {
      updates.received_date = today;
      if (updatedBy) updates.received_by = updatedBy;
    }

    try {
      const { data, error } = await db
        .from('purchase_quotation_shipments')
        .update(updates)
        .eq('id', shipmentId)
        .eq('company_id', companyId)
        .select('*, quotation:quotations(quotation_number, party:parties(name))')
        .maybeSingle();

      if (error !== null) throw error;
      if (data !== null) return mapRowToShipment(data as unknown as RawShipmentRow);
    } catch (err) {
      logger.warn('shipmentsApi', 'Update stage DB fallback:', err);
    }

    if (current !== null) {
      current.tracking_status = stage;
      current.timeline = timeline;
      if (stage === 'arrived_at_office') current.actual_arrival_date = today;
      if (stage === 'received_at_warehouse') {
        current.received_date = today;
        current.received_by = updatedBy;
      }
      return current;
    }
    return null;
  },

  /**
   * حذف شحنة
   */
  deleteShipment: async (companyId: string, shipmentId: string): Promise<void> => {
    try {
      await db
        .from('purchase_quotation_shipments')
        .delete()
        .eq('id', shipmentId)
        .eq('company_id', companyId);
    } catch (err) {
      logger.error('shipmentsApi', 'deleteShipment error:', err);
    }
  },
};

