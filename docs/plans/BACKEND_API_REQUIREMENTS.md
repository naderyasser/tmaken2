# Backend API Requirements for Count Reconciliation

## Overview
The frontend now supports flexible count reconciliation for multiple doctypes. The following API endpoints are required in the backend.

---

## 1. Get Count Data API
**Endpoint:** `/api/method/base_meena.api.inventory_api.get_count_data`

**Method:** GET

**Parameters:**
- `doctype` (string, required): The doctype to fetch data for
  - `Item` - Already handled by existing binStock API
  - `Sales Return`
  - `Purchase Return`
  - `Asset`
  - `Batch`
  - `Serial No`
- `warehouse` (string, required): The warehouse to filter by

**Response Format:**
```json
{
  "message": [
    {
      "name": "ITEM-001",
      "item_code": "ITEM-001",
      "item_name": "Product Name",
      "qty": 10,
      "quantity": 10,
      "valuation_rate": 100.5,
      "stock_uom": "Nos",
      "uom": "Nos"
    }
  ]
}
```

**Implementation Example (Python - Frappe):**

```python
# In: base_meena/api/inventory_api.py

@frappe.whitelist()
def get_count_data(doctype, warehouse):
    """
    Get count data for any doctype in a specific warehouse
    """
    if not doctype or not warehouse:
        frappe.throw("Doctype and Warehouse are required")

    # Validate doctype
    allowed_doctypes = ["Item", "Sales Return", "Purchase Return", "Asset", "Batch", "Serial No"]
    if doctype not in allowed_doctypes:
        frappe.throw(f"Doctype {doctype} is not allowed for count reconciliation")

    data = []

    if doctype == "Item":
        # Use existing bin logic
        data = frappe.db.sql("""
            SELECT
                b.item_code as name,
                b.item_code,
                i.item_name,
                b.actual_qty as qty,
                b.valuation_rate,
                i.stock_uom
            FROM `tabBin` b
            LEFT JOIN `tabItem` i ON b.item_code = i.name
            WHERE b.warehouse = %s AND b.actual_qty > 0
            ORDER BY i.item_name
        """, (warehouse,), as_dict=True)

    elif doctype == "Sales Return":
        # Get sales returns in the warehouse
        data = frappe.db.sql("""
            SELECT
                sr.name,
                sr.customer as item_name,
                SUM(sri.qty) as qty,
                AVG(sri.rate) as valuation_rate,
                sri.uom as stock_uom
            FROM `tabSales Return` sr
            LEFT JOIN `tabSales Return Item` sri ON sr.name = sri.parent
            WHERE sr.warehouse = %s AND sr.docstatus = 1
            GROUP BY sr.name
            ORDER BY sr.posting_date DESC
        """, (warehouse,), as_dict=True)

    elif doctype == "Purchase Return":
        # Get purchase returns in the warehouse
        data = frappe.db.sql("""
            SELECT
                pr.name,
                pr.supplier as item_name,
                SUM(pri.qty) as qty,
                AVG(pri.rate) as valuation_rate,
                pri.uom as stock_uom
            FROM `tabPurchase Return` pr
            LEFT JOIN `tabPurchase Return Item` pri ON pr.name = pri.parent
            WHERE pr.warehouse = %s AND pr.docstatus = 1
            GROUP BY pr.name
            ORDER BY pr.posting_date DESC
        """, (warehouse,), as_dict=True)

    elif doctype == "Asset":
        # Get assets in the warehouse/location
        data = frappe.db.sql("""
            SELECT
                a.name,
                a.asset_name as item_name,
                1 as qty,
                a.gross_purchase_amount as valuation_rate,
                'Nos' as stock_uom
            FROM `tabAsset` a
            WHERE a.location = %s AND a.status IN ('In Location', 'Submitted')
            ORDER BY a.asset_name
        """, (warehouse,), as_dict=True)

    elif doctype == "Batch":
        # Get batches in the warehouse
        data = frappe.db.sql("""
            SELECT
                b.name,
                CONCAT(b.item, ' - ', b.batch_id) as item_name,
                sle.qty_after_transaction as qty,
                b.item as item_code,
                i.stock_uom
            FROM `tabBatch` b
            LEFT JOIN `tabStock Ledger Entry` sle ON b.batch_id = sle.batch_no
            LEFT JOIN `tabItem` i ON b.item = i.name
            WHERE sle.warehouse = %s
            GROUP BY b.name
            HAVING qty > 0
            ORDER BY b.batch_id
        """, (warehouse,), as_dict=True)

    elif doctype == "Serial No":
        # Get serial numbers in the warehouse
        data = frappe.db.sql("""
            SELECT
                sn.name,
                CONCAT(sn.item_code, ' - ', sn.serial_no) as item_name,
                1 as qty,
                sn.purchase_rate as valuation_rate,
                i.stock_uom
            FROM `tabSerial No` sn
            LEFT JOIN `tabItem` i ON sn.item_code = i.name
            WHERE sn.warehouse = %s AND sn.status = 'Active'
            ORDER BY sn.serial_no
        """, (warehouse,), as_dict=True)

    return data
```

---

## 2. Create Count Reconciliation API
**Endpoint:** `/api/method/base_meena.api.inventory_api.create_count_reconciliation`

**Method:** POST

**Request Body:**
```json
{
  "doctype": "Sales Return",
  "warehouse": "Main Warehouse",
  "remarks": "Monthly count reconciliation",
  "items": [
    {
      "code": "ITEM-001",
      "name": "Product Name",
      "counted_qty": 15,
      "system_qty": 10,
      "difference": 5
    }
  ]
}
```

**Response Format:**
```json
{
  "message": {
    "name": "REC-2025-00001",
    "doctype": "Sales Return",
    "status": "Submitted",
    "total_adjustments": 5
  }
}
```

**Implementation Example (Python - Frappe):**

```python
# In: base_meena/api/inventory_api.py

@frappe.whitelist()
def create_count_reconciliation(doctype, warehouse, items, remarks=None):
    """
    Create a count reconciliation record for any doctype
    """
    import json
    if isinstance(items, str):
        items = json.loads(items)

    if not doctype or not warehouse or not items:
        frappe.throw("Doctype, Warehouse, and Items are required")

    # Create a custom reconciliation document
    doc = frappe.get_doc({
        "doctype": "Count Reconciliation",  # You may need to create this DocType
        "reference_doctype": doctype,
        "warehouse": warehouse,
        "posting_date": frappe.utils.nowdate(),
        "posting_time": frappe.utils.nowtime(),
        "remarks": remarks or f"Count reconciliation for {doctype}",
        "items": []
    })

    # Add items
    for item in items:
        doc.append("items", {
            "item_code": item.get("code"),
            "item_name": item.get("name"),
            "counted_qty": item.get("counted_qty", 0),
            "system_qty": item.get("system_qty", 0),
            "difference": item.get("difference", 0)
        })

    doc.insert()
    doc.submit()

    return {
        "name": doc.name,
        "doctype": doc.reference_doctype,
        "status": doc.docstatus_label,
        "total_adjustments": sum([abs(item.difference) for item in doc.items])
    }
```

---

## 3. Optional: Update Existing Barcode Lookup API
**Endpoint:** `/api/method/base_meena.api.inventory_api.lookup_by_barcode`

**Enhancement:** Add support for `doctype` parameter to filter lookup results

**Updated Parameters:**
- `barcode` (string, required)
- `warehouse` (string, optional)
- `doctype` (string, optional) - **NEW**

**Example Implementation:**
```python
@frappe.whitelist()
def lookup_by_barcode(barcode, warehouse=None, doctype=None):
    """
    Enhanced barcode lookup with doctype filtering
    """
    if not barcode:
        return {"found": False}

    # If doctype is specified, search only in that doctype
    if doctype and doctype != "Item":
        # Custom logic for other doctypes
        # Example for Sales Return:
        if doctype == "Sales Return":
            result = frappe.db.get_value(
                "Sales Return",
                {"custom_barcode": barcode},
                ["name", "customer as display_name"],
                as_dict=True
            )
            if result:
                return {
                    "found": True,
                    "doctype": "Sales Return",
                    "name": result.name,
                    "display_name": result.display_name,
                    "system_qty": 1  # Or fetch from warehouse
                }

    # Default Item lookup (existing logic)
    # ... your existing code ...

    return {"found": False}
```

---

## Required DocType: Count Reconciliation

You may need to create a custom DocType called **"Count Reconciliation"** with the following fields:

### Fields:
1. **reference_doctype** (Data) - The doctype being reconciled
2. **warehouse** (Link - Warehouse)
3. **posting_date** (Date)
4. **posting_time** (Time)
5. **remarks** (Text)
6. **items** (Table - Count Reconciliation Item)
   - item_code (Data)
   - item_name (Data)
   - counted_qty (Float)
   - system_qty (Float)
   - difference (Float)

---

## Testing the APIs

### Test Get Count Data:
```bash
curl "http://your-domain/api/method/base_meena.api.inventory_api.get_count_data?doctype=Item&warehouse=Main%20Warehouse" \
  -H "Cookie: sid=YOUR_SESSION"
```

### Test Create Reconciliation:
```bash
curl -X POST "http://your-domain/api/method/base_meena.api.inventory_api.create_count_reconciliation" \
  -H "Content-Type: application/json" \
  -H "Cookie: sid=YOUR_SESSION" \
  -d '{
    "doctype": "Sales Return",
    "warehouse": "Main Warehouse",
    "remarks": "Test reconciliation",
    "items": [
      {
        "code": "TEST-001",
        "name": "Test Item",
        "counted_qty": 10,
        "system_qty": 8,
        "difference": 2
      }
    ]
  }'
```

---

## Frontend Integration Status
✅ Frontend ready and waiting for these APIs
✅ Loading states implemented
✅ Error handling implemented
✅ Build successful

## Next Steps
1. Implement the backend APIs as documented above
2. Test each API endpoint
3. Verify data flow between frontend and backend
4. Test the complete reconciliation workflow
