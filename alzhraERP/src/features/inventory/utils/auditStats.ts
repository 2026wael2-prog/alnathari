import { toCountedQuantity } from './auditQuantity';

/** Summarizes audit draft rows without changing quantities or losing negative adjustments. */
export function calculateAuditStats(items: ReadonlyArray<Record<string, unknown>>) {
  let counted = 0;
  let discrepancies = 0;
  let matched = 0;
  let discrepancyValue = 0;

  for (const item of items) {
    // [FIX — NaN في الإحصاءات] كان `NaN` القادم من حقل رقمي فارغ يُحتسب صنفاً
    // «مجروداً» ويحوّل صافي الأثر المالي إلى `NaN`. الآن أي قيمة غير منتهية
    // تُعامل كـ«غير مجرود» بلا أي مساس بالكميات نفسها.
    const quantity = toCountedQuantity(item.counted_quantity);
    if (quantity === null) continue;
    counted += 1;

    const expectedRaw = Number(item.expected_quantity);
    const expected = Number.isFinite(expectedRaw) ? expectedRaw : 0;
    const difference = quantity - expected;
    if (difference === 0) {
      matched += 1;
      continue;
    }
    discrepancies += 1;
    const product = (item.products as Record<string, unknown>) || item;
    const unitCostRaw = Number(product.cost_price ?? product.purchase_price ?? 0);
    const unitCost = Number.isFinite(unitCostRaw) ? unitCostRaw : 0;
    discrepancyValue += difference * unitCost;
  }

  return {
    total: items.length,
    counted,
    pending: items.length - counted,
    discrepancies,
    matched,
    discrepancyValue: Number.isFinite(discrepancyValue)
      ? Math.round(discrepancyValue * 100) / 100
      : 0,
  };
}
