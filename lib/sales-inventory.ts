/**
 * Sales Rep Inventory — frontend↔backend field contract.
 *
 * The backend doctype (erpnext/selling/sales_rep_inventory) gives `warehouse`
 * ONE fixed meaning: the rep's van on Load/Unload, the destination on
 * Transfer/Adjustment. The dialog's main combobox means something different
 * per type (Load: pick the SOURCE, Unload: pick the DESTINATION, the van leg
 * is implicit), so these helpers translate between the form shape and the
 * doc fields. Keep in sync with
 * sales_rep_inventory.py::get_stock_entry_route().
 */

export type InventoryTransactionType = 'Load' | 'Unload' | 'Adjustment' | 'Transfer'

export interface InventoryWarehouseForm {
  transaction_type: InventoryTransactionType
  /** main combobox: source for Load, destination for Unload/Transfer, target for Adjustment */
  warehouse: string
  /** second combobox (Transfer only): the source */
  source_warehouse: string
}

export interface InventoryWarehouseFields {
  warehouse: string
  from_warehouse?: string
  to_warehouse?: string
}

/** Load/Unload move stock into/out of the selected rep's van implicitly. */
export function repVanRequired(type: InventoryTransactionType): boolean {
  return type === 'Load' || type === 'Unload'
}

/**
 * Doc fields for create/update. `repVan` is the selected rep's
 * inventory_warehouse — required (and validated by callers) for Load/Unload.
 */
export function buildWarehouseFields(form: InventoryWarehouseForm, repVan: string): InventoryWarehouseFields {
  switch (form.transaction_type) {
    case 'Load':
      return { warehouse: repVan, from_warehouse: form.warehouse }
    case 'Unload':
      return { warehouse: repVan, to_warehouse: form.warehouse }
    case 'Transfer':
      return { warehouse: form.warehouse, from_warehouse: form.source_warehouse }
    case 'Adjustment':
    default:
      return { warehouse: form.warehouse }
  }
}

/** The warehouse stock is deducted FROM (pre-check target); null = pure receipt. */
export function stockCheckWarehouse(form: InventoryWarehouseForm, repVan: string): string | null {
  switch (form.transaction_type) {
    case 'Load':
      return form.warehouse || null
    case 'Unload':
      return repVan || null
    case 'Transfer':
      return form.source_warehouse || null
    default:
      return null // Adjustment is a Material Receipt — nothing is deducted
  }
}

/**
 * Options for the main combobox. Where the van leg is implicit (Load source,
 * Unload destination) vans are hidden — moving van→van is the Transfer type.
 */
export function selectableWarehouses(
  type: InventoryTransactionType,
  warehouses: string[],
  vans: Set<string>,
): string[] {
  if (repVanRequired(type)) return warehouses.filter(w => !vans.has(w))
  return warehouses
}

/**
 * Inverse mapping when editing a draft. Legacy drafts (created before the
 * contract fix) stored the picked source in `warehouse` with from/to empty —
 * for those the picker comes back empty and the user re-picks; the stored
 * value must never be misread as the other leg.
 */
export function warehouseFormFromRecord(rec: {
  transaction_type?: string
  warehouse?: string | null
  from_warehouse?: string | null
  to_warehouse?: string | null
}): { warehouse: string; source_warehouse: string } {
  switch (rec.transaction_type) {
    case 'Load':
      return { warehouse: rec.from_warehouse || '', source_warehouse: '' }
    case 'Unload':
      return { warehouse: rec.to_warehouse || '', source_warehouse: '' }
    case 'Transfer':
      return { warehouse: rec.warehouse || '', source_warehouse: rec.from_warehouse || '' }
    default:
      return { warehouse: rec.warehouse || '', source_warehouse: '' }
  }
}
