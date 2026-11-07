/**
 * purchase_quotation_shipments types
 * تتبع شحنات عروض الشراء عبر مكاتب شركات الشحن (خط صنعاء - المهرة)
 */

export type ShipmentTrackingStage =
  | 'pending_dispatch'       // قيد التجهيز والتغليف لدى مورد صنعاء
  | 'handed_to_office'       // سُلمت لمكتب الشحن في صنعاء مع سند الشحن
  | 'in_transit'             // على الطريق بين المحافظات (صنعاء ➔ المهرة)
  | 'arrived_at_office'      // وصلت فرع مكتب الشحن بالمهرة (الغيضة / شحن)
  | 'received_at_warehouse'  // استُلمت وفُحصت في مستودع المنشأة بالمهرة
  | 'cancelled';             // ملغية / مرتجعة

export type ShippingPaymentMethod =
  | 'collect_on_delivery' // دفع عند الاستلام في المهرة (COD)
  | 'prepaid_by_supplier' // مدفوع مقدماً من المورد في صنعاء
  | 'on_company_account'; // مسجل على حساب المنشأة لدى مكتب الشحن

export interface ShipmentTimelineEvent {
  id: string;
  stage: ShipmentTrackingStage;
  timestamp: string;
  location: string;
  note: string;
  updatedBy?: string | undefined;
}

export interface PurchaseQuotationShipment {
  id: string;
  company_id: string;
  quotation_id: string;
  quotation_number?: string | undefined;
  supplier_name?: string | undefined;

  // بيانات مكتب / شركة الشحن
  shipping_company_name: string;
  shipping_office_phone: string;
  shipping_office_address: string;
  waybill_number: string; // رقم البوليصة / سند الإرسالية

  // المسار الجغرافي (صنعاء ➔ المهرة)
  origin_city: string; // افتراضي: صنعاء
  origin_hub?: string | undefined; // مثل: فرع الحصبة / مذبح / شارع خولان
  destination_city: string; // افتراضي: المهرة (الغيضة)
  destination_hub?: string | undefined; // مثل: فرع الغيضة - شارع المطار / فرع شحن
  destination_branch_id?: string | null | undefined;
  destination_warehouse_id?: string | null | undefined;

  // بيانات الناقل والسائق
  driver_name: string;
  driver_phone: string;
  vehicle_plate_number: string;
  vehicle_type: string; // دينا، قاطرة، شاحنة متوسطة، ونيت

  // تفاصيل الحمولة والطرود
  parcel_count: number;
  weight_kg: number;
  cargo_description: string;

  // التكاليف وأجور الشحن
  shipping_cost: number;
  shipping_currency: string; // YER أو SAR
  payment_method: ShippingPaymentMethod;

  // التواريخ
  shipping_date: string; // تاريخ التسليم لمكتب الشحن
  expected_arrival_date: string; // تاريخ الوصول المتوقع
  actual_arrival_date?: string | null | undefined;
  received_date?: string | null | undefined;
  received_by?: string | undefined;

  // الحالة ومسار التتبع
  tracking_status: ShipmentTrackingStage;
  timeline: ShipmentTimelineEvent[];
  notes?: string | undefined;

  created_at: string;
  updated_at: string;
  created_by?: string | undefined;
}

export interface UpsertShipmentDTO {
  id?: string | undefined;
  quotation_id: string;
  shipping_company_name: string;
  shipping_office_phone?: string | undefined;
  shipping_office_address?: string | undefined;
  waybill_number: string;

  origin_city?: string | undefined;
  origin_hub?: string | undefined;
  destination_city?: string | undefined;
  destination_hub?: string | undefined;
  destination_branch_id?: string | null | undefined;
  destination_warehouse_id?: string | null | undefined;

  driver_name?: string | undefined;
  driver_phone?: string | undefined;
  vehicle_plate_number?: string | undefined;
  vehicle_type?: string | undefined;

  parcel_count?: number | undefined;
  weight_kg?: number | undefined;
  cargo_description?: string | undefined;

  shipping_cost?: number | undefined;
  shipping_currency?: string | undefined;
  payment_method?: ShippingPaymentMethod | undefined;

  shipping_date?: string | undefined;
  expected_arrival_date?: string | undefined;
  actual_arrival_date?: string | null | undefined;
  received_date?: string | null | undefined;
  received_by?: string | undefined;

  tracking_status?: ShipmentTrackingStage | undefined;
  notes?: string | undefined;
  timelineEvent?: {
    stage: ShipmentTrackingStage;
    location: string;
    note: string;
  } | undefined;
}

/** مكاتب وشركات الشحن المعتمدة على خط صنعاء - المهرة */
export interface ShippingCompanyPreset {
  name: string;
  sanaaHub: string;
  mahrahHub: string;
  defaultPhone: string;
}

export const YEMEN_SHIPPING_COMPANIES: ShippingCompanyPreset[] = [
  {
    name: 'شركة الرويشان للنقليات والشحن البري',
    sanaaHub: 'صنعاء — فرع مذبح / الحصبة',
    mahrahHub: 'المهرة — الغيضة (شارع المطار)',
    defaultPhone: '01-234567',
  },
  {
    name: 'مكتب البراق للنقليات السريعة',
    sanaaHub: 'صنعاء — جولة عمران / شارع خولان',
    mahrahHub: 'المهرة — الغيضة (المدخل الجنوبي)',
    defaultPhone: '01-345678',
  },
  {
    name: 'نقليات النمر للشحن البري والبضائع',
    sanaaHub: 'صنعاء — شارع تعز / الحثيلي',
    mahrahHub: 'المهرة — شحن (المنفذ الجمركي)',
    defaultPhone: '01-456789',
  },
  {
    name: 'مكتب الشامل للشحن والتخليص الجمركي',
    sanaaHub: 'صنعاء — حي الجراف / المطار',
    mahrahHub: 'المهرة — الغيضة وشحن',
    defaultPhone: '01-567890',
  },
  {
    name: 'نقليات الجزيرة للشحن والتوصيل',
    sanaaHub: 'صنعاء — شارع خولان',
    mahrahHub: 'المهرة — الغيضة',
    defaultPhone: '01-678901',
  },
  {
    name: 'نقليات اليمامة والراية السريعة',
    sanaaHub: 'صنعاء — جولة الحصبة',
    mahrahHub: 'المهرة — الغيضة وحوف',
    defaultPhone: '01-789012',
  },
  {
    name: 'مكتب أبو سرهد للنقل والشحن البري',
    sanaaHub: 'صنعاء — الستين الجنوبي',
    mahrahHub: 'المهرة — الغيضة',
    defaultPhone: '01-890123',
  },
  {
    name: 'نقليات راحة للنقل والشحن الداخلي',
    sanaaHub: 'صنعاء — الزبيري / عصر',
    mahrahHub: 'المهرة — الغيضة',
    defaultPhone: '01-901234',
  },
];

/** المحطات الرئيسية لخط السير صنعاء - المهرة */
export const SANA_MAHRAH_TRANSIT_STATIONS = [
  { id: 'sanaa', name: 'صنعاء (نقطة الانطلاق)', province: 'أمانة العاصمة' },
  { id: 'marib', name: 'مأرب', province: 'مأرب' },
  { id: 'aber', name: 'العبر', province: 'حضرموت' },
  { id: 'seiyun', name: 'سيئون / تريم', province: 'وادي حضرموت' },
  { id: 'mukalla', name: 'المكلا / الشحر', province: 'ساحل حضرموت' },
  { id: 'sayhut', name: 'سيحوت / قشن', province: 'المهرة' },
  { id: 'alghaydah', name: 'الغيضة (عاصمة المهرة)', province: 'المهرة' },
  { id: 'shahan', name: 'منفذ شحن الحدودي', province: 'المهرة' },
  { id: 'hawf', name: 'محمية حوف', province: 'المهرة' },
];

