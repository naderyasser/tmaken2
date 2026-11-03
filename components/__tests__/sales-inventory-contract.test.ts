/**
 * Sales Rep Inventory — frontend↔backend field contract guards.
 *
 * Regression for the "Load — Warehouse → Rep" bug: the dialog labeled
 * `warehouse` as the SOURCE while the backend treats `warehouse` as the
 * rep's van and reads the source from `from_warehouse`. Loads therefore
 * validated stock against the (empty) van — "never stocked in Van - X" —
 * and could never submit ("From Warehouse is required").
 * Mapping must mirror sales_rep_inventory.py::get_stock_entry_route().
 */
import {
  buildWarehouseFields,
  repVanRequired,
  selectableWarehouses,
  stockCheckWarehouse,
  warehouseFormFromRecord,
  type InventoryWarehouseForm,
} from '@/lib/sales-inventory'

const VAN = 'Van - مندوب محمود - M'
const MAIN = 'Stores - M'
const OTHER_VAN = 'Meena Van 1 - M'

const form = (overrides: Partial<InventoryWarehouseForm>): InventoryWarehouseForm => ({
  transaction_type: 'Load',
  warehouse: '',
  source_warehouse: '',
  ...overrides,
})

describe('buildWarehouseFields — doc fields per transaction type', () => {
  it('Load: picked warehouse is the SOURCE, the rep van is the doc warehouse', () => {
    expect(buildWarehouseFields(form({ transaction_type: 'Load', warehouse: MAIN }), VAN)).toEqual({
      warehouse: VAN,
      from_warehouse: MAIN,
    })
  })

  it('Load: never sends the picked source as the doc warehouse (the original bug)', () => {
    const fields = buildWarehouseFields(form({ transaction_type: 'Load', warehouse: MAIN }), VAN)
    expect(fields.warehouse).not.toBe(MAIN)
    expect(fields.from_warehouse).toBe(MAIN)
  })

  it('Unload: picked warehouse is the DESTINATION, the van is the doc warehouse', () => {
    expect(buildWarehouseFields(form({ transaction_type: 'Unload', warehouse: MAIN }), VAN)).toEqual({
      warehouse: VAN,
      to_warehouse: MAIN,
    })
  })

  it('Transfer: destination in warehouse, source in from_warehouse', () => {
    expect(
      buildWarehouseFields(form({ transaction_type: 'Transfer', warehouse: OTHER_VAN, source_warehouse: VAN }), '')
    ).toEqual({ warehouse: OTHER_VAN, from_warehouse: VAN })
  })

  it('Adjustment: picked warehouse is the receipt target, no from/to legs', () => {
    expect(buildWarehouseFields(form({ transaction_type: 'Adjustment', warehouse: VAN }), VAN)).toEqual({
      warehouse: VAN,
    })
  })
})

describe('stockCheckWarehouse — where the availability pre-check runs', () => {
  it('Load checks the picked source, NOT the rep van', () => {
    const f = form({ transaction_type: 'Load', warehouse: MAIN })
    expect(stockCheckWarehouse(f, VAN)).toBe(MAIN)
    expect(stockCheckWarehouse(f, VAN)).not.toBe(VAN)
  })

  it('Unload checks the rep van (stock leaves the van)', () => {
    expect(stockCheckWarehouse(form({ transaction_type: 'Unload', warehouse: MAIN }), VAN)).toBe(VAN)
  })

  it('Transfer checks the source combobox', () => {
    expect(
      stockCheckWarehouse(form({ transaction_type: 'Transfer', warehouse: MAIN, source_warehouse: VAN }), '')
    ).toBe(VAN)
  })

  it('Adjustment (Material Receipt) checks nothing', () => {
    expect(stockCheckWarehouse(form({ transaction_type: 'Adjustment', warehouse: VAN }), VAN)).toBeNull()
  })

  it('returns null instead of an empty string when nothing is picked yet', () => {
    expect(stockCheckWarehouse(form({ transaction_type: 'Load' }), VAN)).toBeNull()
    expect(stockCheckWarehouse(form({ transaction_type: 'Unload' }), '')).toBeNull()
  })
})

describe('selectableWarehouses — vans hidden where the van leg is implicit', () => {
  const all = [MAIN, VAN, OTHER_VAN, 'Finished Goods - M']
  const vans = new Set([VAN, OTHER_VAN])

  it('Load and Unload never offer vans', () => {
    expect(selectableWarehouses('Load', all, vans)).toEqual([MAIN, 'Finished Goods - M'])
    expect(selectableWarehouses('Unload', all, vans)).toEqual([MAIN, 'Finished Goods - M'])
  })

  it('Transfer and Adjustment keep vans (rep-to-rep moves, van adjustments)', () => {
    expect(selectableWarehouses('Transfer', all, vans)).toEqual(all)
    expect(selectableWarehouses('Adjustment', all, vans)).toEqual(all)
  })
})

describe('warehouseFormFromRecord — editing existing drafts', () => {
  it('round-trips a post-fix Load record', () => {
    expect(
      warehouseFormFromRecord({ transaction_type: 'Load', warehouse: VAN, from_warehouse: MAIN })
    ).toEqual({ warehouse: MAIN, source_warehouse: '' })
  })

  it('legacy pre-fix Load draft (source stored in warehouse, from empty) comes back blank for a re-pick', () => {
    // e.g. the stranded qarawi drafts REP-INV-Nader Yasser-0010x
    expect(
      warehouseFormFromRecord({ transaction_type: 'Load', warehouse: 'Stores - Q', from_warehouse: null })
    ).toEqual({ warehouse: '', source_warehouse: '' })
  })

  it('Unload maps to_warehouse back into the picker', () => {
    expect(
      warehouseFormFromRecord({ transaction_type: 'Unload', warehouse: VAN, to_warehouse: MAIN })
    ).toEqual({ warehouse: MAIN, source_warehouse: '' })
  })

  it('Transfer restores both comboboxes', () => {
    expect(
      warehouseFormFromRecord({ transaction_type: 'Transfer', warehouse: OTHER_VAN, from_warehouse: VAN })
    ).toEqual({ warehouse: OTHER_VAN, source_warehouse: VAN })
  })
})

describe('repVanRequired', () => {
  it('only Load and Unload require the implicit rep van', () => {
    expect(repVanRequired('Load')).toBe(true)
    expect(repVanRequired('Unload')).toBe(true)
    expect(repVanRequired('Transfer')).toBe(false)
    expect(repVanRequired('Adjustment')).toBe(false)
  })
})
