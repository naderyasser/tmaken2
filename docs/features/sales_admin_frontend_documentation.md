# Sales Admin System — Frontend Documentation (Next.js)

> **Target:** Admin-only Next.js frontend that manages the full sales operations system.  
> **Backend:** ERPNext (Frappe framework) with custom Qarawi selling modules.  
> **Base URL:** `https://<your-site>`

---

## Table of Contents

1. [Authentication & Session](#1-authentication--session)
2. [Frappe API Patterns (CRUD)](#2-frappe-api-patterns-crud)
3. [Customer Management](#3-customer-management)
4. [Sales Orders](#4-sales-orders)
5. [Quotations](#5-quotations)
6. [Sales Invoice](#6-sales-invoice)
7. [Payment Entry](#7-payment-entry)
8. [Items & Pricing](#8-items--pricing)
9. [Pricing Rules](#9-pricing-rules)
10. [Sales Representatives](#10-sales-representatives)
11. [Sales Person Visits](#11-sales-person-visits)
12. [Daily Route Plans](#12-daily-route-plans)
13. [Route Map](#13-route-map)
14. [Sales Route Analytics](#14-sales-route-analytics)
15. [Discount Permission Profiles](#15-discount-permission-profiles)
16. [Discount Approval Requests](#16-discount-approval-requests)
17. [Discount Validation Engine](#17-discount-validation-engine)
18. [Sales Rep Inventory](#18-sales-rep-inventory)
19. [Customer Inventory Records](#19-customer-inventory-records)
20. [Product Returns from Customers](#20-product-returns-from-customers)
21. [Reports](#21-reports)
22. [File Upload](#22-file-upload)

---

## 1. Authentication & Session

### Login

```
POST /api/method/login
Content-Type: application/x-www-form-urlencoded
```

**Body:**

| Field | Type   | Description      |
|-------|--------|------------------|
| `usr` | string | Email or username |
| `pwd` | string | Password          |

**Response:**

```json
{
  "message": "Logged In",
  "home_page": "/app",
  "full_name": "Administrator"
}
```

On success the server sets session cookies (`sid`, `user_id`, `system_user`).  
Store the `sid` cookie and send it with all subsequent requests.

### Logout

```
POST /api/method/logout
```

### CSRF Token

Every mutating request (POST / PUT / DELETE) requires the header:

```
X-Frappe-CSRF-Token: <token>
```

Fetch the token after login:

```
GET /api/method/frappe.auth.get_logged_user
```

The CSRF token is returned in the cookie `csrf_token` and also available in `frappe.csrf_token` on the browser session.

---

## 2. Frappe API Patterns (CRUD)

All doctypes share the same generic REST API. Use these endpoints for listing, creating, reading, updating, and deleting any document.

### Base URL Pattern

```
/api/resource/{DocType}
/api/resource/{DocType}/{name}
```

### List Documents

```
GET /api/resource/{DocType}
```

**Query Parameters:**

| Parameter  | Type   | Description                                              |
|------------|--------|----------------------------------------------------------|
| `fields`   | JSON   | `["name","customer_name","status"]`                      |
| `filters`  | JSON   | `[["status","=","Active"],["territory","=","Riyadh"]]`   |
| `limit`    | int    | Records per page (default 20)                            |
| `limit_start` | int | Offset for pagination (default 0)                      |
| `order_by` | string | e.g. `"creation desc"`                                  |

**Response:**

```json
{
  "data": [
    { "name": "CUST-0001", "customer_name": "...", "status": "Active" }
  ]
}
```

### Get Single Document

```
GET /api/resource/{DocType}/{name}
```

Returns the full document with all fields and child tables.

### Create Document

```
POST /api/resource/{DocType}
Content-Type: application/json

{ "customer_name": "ACME Co", "customer_type": "Company", ... }
```

**Response:**

```json
{ "data": { "name": "CUST-0002", ... } }
```

### Update Document

```
PUT /api/resource/{DocType}/{name}
Content-Type: application/json

{ "territory": "Riyadh" }
```

### Delete Document

```
DELETE /api/resource/{DocType}/{name}
```

### Submit Document

```
POST /api/method/frappe.client.submit
Content-Type: application/json

{ "doc": { "doctype": "Sales Order", "name": "SAL-ORD-0001", ... } }
```

### Cancel Document

```
POST /api/method/frappe.client.cancel
Content-Type: application/json

{ "doctype": "Sales Order", "name": "SAL-ORD-0001" }
```

### Set Specific Fields

```
POST /api/method/frappe.client.set_value
Content-Type: application/json

{
  "doctype": "Customer",
  "name": "CUST-0001",
  "fieldname": { "territory": "Jeddah", "customer_group": "Retail" }
}
```

### Run a Doc Method

```
POST /api/resource/{DocType}/{name}
Content-Type: application/json

{ "run_method": "method_name", "arg1": "value" }
```

### Count Documents

```
GET /api/method/frappe.client.get_count?doctype=Customer&filters=[["disabled","=",0]]
```

---

## 3. Customer Management

**DocType:** `Customer`

### Key Fields

| Field                    | Type     | Description                              |
|--------------------------|----------|------------------------------------------|
| `customer_name`          | Data     | Full name                                |
| `customer_type`          | Select   | `Company` / `Individual` / `Partnership` |
| `customer_group`         | Link     | Customer Group                           |
| `territory`              | Link     | Territory                                |
| `disabled`               | Check    | Soft delete                              |
| `tax_id`                 | Data     | VAT / Tax number                         |
| `payment_terms`          | Link     | Default payment terms                    |
| `credit_limits`          | Table    | Per-company credit limits                |
| `sales_team`             | Table    | Assigned sales team members              |
| `default_sales_partner`  | Link     | Sales Partner                            |
| **Custom Fields**        |          |                                          |
| `primary_sales_person`   | Link     | Sales Person (admin assignment)          |
| `last_visit_date`        | Date     | Auto-updated on visit check-out          |
| `last_visit_by`          | Link     | Sales Person who last visited            |
| `visit_frequency_days`   | Int      | Expected visit interval in days          |
| `preferred_visit_day`    | Select   | Sat / Sun / Mon / Tue / Wed / Thu / Fri  |
| `customer_lat`           | Data     | GPS latitude of customer location        |
| `customer_lng`           | Data     | GPS longitude of customer location       |
| `customer_inventory_tracked` | Check | Whether inventory is tracked at this customer |

### List Customers

```
GET /api/resource/Customer?fields=["name","customer_name","customer_group","territory","primary_sales_person","disabled"]&filters=[["disabled","=",0]]&order_by=customer_name asc
```

### Create Customer

```
POST /api/resource/Customer
{
  "customer_name": "Al Rahma Trading",
  "customer_type": "Company",
  "customer_group": "Commercial",
  "territory": "Riyadh",
  "primary_sales_person": "SP-0001",
  "customer_lat": "24.6877",
  "customer_lng": "46.7219",
  "visit_frequency_days": 7
}
```

### Get Customer Details

```
GET /api/resource/Customer/CUST-0001
```

### Update Customer GPS / Sales Person

```
PUT /api/resource/Customer/CUST-0001
{
  "customer_lat": "24.6900",
  "customer_lng": "46.7250",
  "primary_sales_person": "SP-0002"
}
```

### Get Customer Group Default Accounts

```
POST /api/resource/Customer/CUST-0001
{ "run_method": "get_customer_group_details" }
```

### Get Applicable Loyalty Programs

```
POST /api/method/erpnext.selling.doctype.customer.customer.get_loyalty_programs
{ "customer": { "customer_name": "...", "customer_group": "Retail", "territory": "Riyadh" } }
```

Returns list of loyalty program names.

### Create Quotation from Customer

```
POST /api/method/erpnext.selling.doctype.customer.customer.make_quotation
{ "source_name": "CUST-0001" }
```

Returns an unsaved Quotation doc.

### Create Opportunity from Customer

```
POST /api/method/erpnext.selling.doctype.customer.customer.make_opportunity
{ "source_name": "CUST-0001" }
```

---

## 4. Sales Orders

**DocType:** `Sales Order`

### Key Fields

| Field             | Type     | Description                                                   |
|-------------------|----------|---------------------------------------------------------------|
| `customer`        | Link     | Customer                                                      |
| `order_type`      | Select   | `Sales` / `Maintenance` / `Shopping Cart`                     |
| `transaction_date`| Date     | Order date                                                    |
| `delivery_date`   | Date     | Expected delivery                                             |
| `items`           | Table    | Sales Order Items                                             |
| `status`          | Select   | `Draft` / `On Hold` / `To Deliver and Bill` / `To Bill` / `To Deliver` / `Completed` / `Cancelled` / `Closed` |
| `grand_total`     | Currency | Total amount                                                  |
| `sales_team`      | Table    | Assigned sales team                                          |
| `delivery_status` | Select   | `Not Delivered` / `Partially Delivered` / `Fully Delivered`   |
| `billing_status`  | Select   | `Not Billed` / `Partially Billed` / `Fully Billed`            |
| **Custom Fields** |          |                                                               |
| `total_discount_amount` | Currency | Total discount applied (custom)                       |
| `discount_approved_by`  | Link    | User who approved discount                             |

### List Sales Orders

```
GET /api/resource/Sales Order?fields=["name","customer","status","grand_total","transaction_date","delivery_date"]&filters=[["status","!=","Cancelled"]]&order_by=transaction_date desc
```

### Create Sales Order

```
POST /api/resource/Sales Order
{
  "customer": "CUST-0001",
  "order_type": "Sales",
  "transaction_date": "2026-02-18",
  "delivery_date": "2026-02-25",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 10,
      "rate": 150.00,
      "delivery_date": "2026-02-25"
    }
  ]
}
```

### Submit Sales Order

```
POST /api/method/frappe.client.submit
{ "doc": { "doctype": "Sales Order", "name": "SAL-ORD-0001", "docstatus": 0 } }
```

### Close / Unclose Sales Orders (Bulk)

```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders
{
  "names": "[\"SAL-ORD-0001\", \"SAL-ORD-0002\"]",
  "status": "Closed"
}
```

### Create Delivery Note from Sales Order

```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.make_delivery_note
{ "source_name": "SAL-ORD-0001" }
```

Returns an unsaved Delivery Note doc.

### Create Sales Invoice from Sales Order

```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice
{ "source_name": "SAL-ORD-0001" }
```

### Create Material Request from Sales Order

```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.make_material_request
{ "source_name": "SAL-ORD-0001" }
```

### Create Purchase Order for Default Supplier

```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.make_purchase_order_for_default_supplier
{
  "source_name": "SAL-ORD-0001",
  "selected_items": "[{\"item_code\": \"ITEM-001\", \"qty\": 10}]"
}
```

### Create Pick List

```
POST /api/method/erpnext.selling.doctype.sales_order.sales_order.create_pick_list
{ "source_name": "SAL-ORD-0001" }
```

### Get Stock Reservation Status

```
GET /api/method/erpnext.selling.doctype.sales_order.sales_order.get_stock_reservation_status
```

---

## 5. Quotations

**DocType:** `Quotation`

### Key Fields

| Field           | Type     | Description                                                                        |
|-----------------|----------|------------------------------------------------------------------------------------|
| `quotation_to`  | Select   | `Customer` / `Lead` / `Prospect`                                                   |
| `party_name`    | Dynamic Link | Customer / Lead / Prospect name                                               |
| `transaction_date` | Date  | Quote date                                                                         |
| `valid_till`    | Date     | Expiry date                                                                        |
| `status`        | Select   | `Draft` / `Open` / `Replied` / `Partially Ordered` / `Ordered` / `Lost` / `Cancelled` / `Expired` |
| `items`         | Table    | Quotation Items                                                                    |
| `grand_total`   | Currency |                                                                                    |
| `lost_reasons`  | Table    | Reasons if lost                                                                    |

### List Quotations

```
GET /api/resource/Quotation?fields=["name","party_name","status","grand_total","valid_till"]&order_by=transaction_date desc
```

### Create Quotation

```
POST /api/resource/Quotation
{
  "quotation_to": "Customer",
  "party_name": "CUST-0001",
  "transaction_date": "2026-02-18",
  "valid_till": "2026-03-18",
  "items": [
    { "item_code": "ITEM-001", "qty": 5, "rate": 200 }
  ]
}
```

### Convert Quotation to Sales Order

```
POST /api/method/erpnext.selling.doctype.quotation.quotation.make_sales_order
{ "source_name": "QTN-0001" }
```

### Convert Quotation to Sales Invoice

```
POST /api/method/erpnext.selling.doctype.quotation.quotation.make_sales_invoice
{ "source_name": "QTN-0001" }
```

### Mark Quotation as Lost

```
POST /api/resource/Quotation/QTN-0001
{
  "run_method": "declare_enquiry_lost",
  "lost_reasons_list": [{ "lost_reason": "Price too high" }],
  "competitors": [],
  "detailed_reason": "Customer found cheaper supplier"
}
```

---

## 6. Sales Invoice

**DocType:** `Sales Invoice`

### Key Fields

| Field                    | Type     | Description                                              |
|--------------------------|----------|----------------------------------------------------------|
| `customer`               | Link     | Customer                                                 |
| `posting_date`           | Date     | Invoice date                                             |
| `due_date`               | Date     | Payment due                                              |
| `items`                  | Table    | Sales Invoice Items                                      |
| `taxes`                  | Table    | Tax rows                                                 |
| `grand_total`            | Currency | Final total                                              |
| `outstanding_amount`     | Currency | Remaining unpaid                                         |
| `status`                 | Select   | `Draft` / `Submitted` / `Return` / `Credit Note Issued` / `Unpaid` / `Paid` / `Overdue` / `Cancelled` |
| `is_pos`                 | Check    | Point of Sale invoice                                    |
| `sales_team`             | Table    | Assigned sales reps                                      |
| **Custom Fields**        |          |                                                          |
| `total_discount_amount`  | Currency | Total discount on the invoice                            |
| `discount_percentage_total` | Percent | Total discount percentage                             |
| `discount_approved_by`   | Link     | User who approved the discount                           |
| `discount_approval_reference` | Link | Linked Discount Approval Request                     |

### List Sales Invoices

```
GET /api/resource/Sales Invoice?fields=["name","customer","status","grand_total","outstanding_amount","posting_date"]&filters=[["docstatus","=",1]]&order_by=posting_date desc
```

### Create Sales Invoice

```
POST /api/resource/Sales Invoice
{
  "customer": "CUST-0001",
  "posting_date": "2026-02-18",
  "due_date": "2026-03-18",
  "items": [
    { "item_code": "ITEM-001", "qty": 2, "rate": 500.00 }
  ]
}
```

### Submit Invoice

```
POST /api/method/frappe.client.submit
{ "doc": { "doctype": "Sales Invoice", "name": "SINV-0001" } }
```

### Create Return / Credit Note

```
POST /api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.make_return_doc
{ "source_name": "SINV-0001" }
```

### Create Delivery Note from Invoice

```
POST /api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.make_delivery_note
{ "source_name": "SINV-0001" }
```

### Create Dunning (Payment Reminder)

```
POST /api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.make_dunning
{ "source_name": "SINV-0001" }
```

### Get Default Bank Account

```
POST /api/method/erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account
{
  "mode_of_payment": "Cash",
  "company": "My Company"
}
```

---

## 7. Payment Entry

**DocType:** `Payment Entry`

### Create Payment from Invoice

```
POST /api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry
{
  "dt": "Sales Invoice",
  "dn": "SINV-0001"
}
```

Returns an unsaved Payment Entry pre-filled with customer, account, and outstanding amount.

### Get Outstanding Invoices for Customer

```
POST /api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents
{
  "args": {
    "party_type": "Customer",
    "party": "CUST-0001",
    "company": "My Company",
    "party_account": "Debtors - MC"
  }
}
```

**Returns:** List of outstanding invoices with `voucher_no`, `posting_date`, `invoice_amount`, `outstanding_amount`.

### Get Party Details

```
POST /api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details
{
  "company": "My Company",
  "party_type": "Customer",
  "party": "CUST-0001",
  "date": "2026-02-18",
  "cost_center": "Main - MC"
}
```

**Returns:** `party_account`, `party_account_currency`, `party_balance`, `bank_account`, `party_name`.

### Get Reference Details (Invoice Amount)

```
POST /api/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_reference_details
{
  "reference_doctype": "Sales Invoice",
  "reference_name": "SINV-0001",
  "party_account_currency": "SAR"
}
```

### Submit Payment Entry

```
POST /api/method/frappe.client.submit
{ "doc": { "doctype": "Payment Entry", "name": "PE-0001" } }
```

---

## 8. Items & Pricing

**DocType:** `Item`

### List Items

```
GET /api/resource/Item?fields=["name","item_name","item_group","stock_uom","standard_rate","disabled"]&filters=[["disabled","=",0],["is_sales_item","=",1]]&order_by=item_name asc
```

### Get Item Details (with company defaults)

```
POST /api/method/erpnext.stock.doctype.item.item.get_item_details
{
  "args": {
    "item_code": "ITEM-001",
    "company": "My Company",
    "price_list": "Standard Selling",
    "customer": "CUST-0001",
    "transaction_date": "2026-02-18",
    "doctype": "Sales Order"
  }
}
```

**Returns:** `item_name`, `description`, `stock_uom`, `price_list_rate`, `discount_percentage`, `item_tax_template`, warehouse defaults, etc.

### Get UOM Conversion Factor

```
POST /api/method/erpnext.stock.doctype.item.item.get_uom_conv_factor
{
  "item_code": "ITEM-001",
  "uom": "Carton"
}
```

### Get Item Stock in Warehouse

```
POST /api/method/erpnext.stock.doctype.stock_entry.stock_entry.get_item_details
{
  "args": {
    "item_code": "ITEM-001",
    "warehouse": "Stores - MC"
  }
}
```

### Check Item Serial/Batch

```
GET /api/method/erpnext.stock.doctype.item.item.search_serial_or_batch_or_barcode_number?search_value=SN-0001
```

---

## 9. Pricing Rules

**DocType:** `Pricing Rule`

### Get Applied Pricing Rules for Transaction

```
POST /api/method/erpnext.accounts.doctype.pricing_rule.pricing_rule.apply_pricing_rule
{
  "args": {
    "doctype": "Sales Order",
    "customer": "CUST-0001",
    "items": [
      {
        "item_code": "ITEM-001",
        "qty": 10,
        "price_list_rate": 150,
        "uom": "Nos"
      }
    ],
    "company": "My Company",
    "transaction_date": "2026-02-18",
    "currency": "SAR"
  }
}
```

**Returns:** Updated items array with `pricing_rules`, `discount_percentage`, `rate` applied.

### Remove Pricing Rule from Item

```
POST /api/method/erpnext.accounts.doctype.pricing_rule.pricing_rule.remove_pricing_rules_for_item
{
  "item": { "pricing_rules": "[\"PRULE-0001\"]", "item_code": "ITEM-001" }
}
```

### Create Pricing Rule for Customer

```
POST /api/method/erpnext.accounts.doctype.pricing_rule.pricing_rule.make_pricing_rule
{
  "doctype": "Customer",
  "name": "CUST-0001"
}
```

Returns unsaved Pricing Rule pre-filled for that customer.

### List Active Pricing Rules

```
GET /api/resource/Pricing Rule?fields=["name","title","applies_on","discount_percentage","for_price_list","valid_upto"]&filters=[["disable","=",0]]
```

---

## 10. Sales Representatives

**DocType:** `Sales Person`

### Key Fields

| Field                    | Type     | Description                                     |
|--------------------------|----------|-------------------------------------------------|
| `sales_person_name`      | Data     | Full name                                       |
| `enabled`                | Check    | Active status                                   |
| `employee`               | Link     | Linked Employee record                          |
| `parent_sales_person`    | Link     | Hierarchy parent                                |
| **Custom Fields**        |          |                                                 |
| `mobile_app_user`        | Link     | Linked User account for mobile app             |
| `has_inventory`          | Check    | Whether this rep carries personal van stock    |
| `inventory_warehouse`    | Link     | Warehouse assigned to this rep                 |
| `current_location_lat`   | Data     | Last known latitude (auto-updated)              |
| `current_location_lng`   | Data     | Last known longitude (auto-updated)             |
| `location_last_updated`  | Datetime | Timestamp of last GPS update                   |
| `discount_permission_profile` | Link | Assigned Discount Permission Profile         |
| `bypass_discount_limits` | Check    | Allows bypassing all discount limits           |

### List Sales Representatives

```
GET /api/resource/Sales Person?fields=["name","sales_person_name","enabled","mobile_app_user","inventory_warehouse","current_location_lat","current_location_lng","location_last_updated"]&filters=[["enabled","=",1]]&order_by=sales_person_name asc
```

### Create Sales Representative

```
POST /api/resource/Sales Person
{
  "sales_person_name": "Ahmed Al-Rashidi",
  "enabled": 1,
  "mobile_app_user": "ahmed@company.com",
  "has_inventory": 1,
  "inventory_warehouse": "Van - Ahmed - MC",
  "discount_permission_profile": "Standard Rep Profile"
}
```

### Assign Discount Profile to Rep

```
PUT /api/resource/Sales Person/SP-0001
{
  "discount_permission_profile": "Senior Rep Profile",
  "bypass_discount_limits": 0
}
```

### Update Sales Person Location (Admin)

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.update_sales_person_location
{
  "sales_person": "SP-0001",
  "latitude": 24.688,
  "longitude": 46.722
}
```

### Get Sales Person Current Location

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_sales_person_location
{ "sales_person": "SP-0001" }
```

**Returns:** `{ "latitude": float, "longitude": float }` or `null`.

### Get Customers Assigned to a Rep

```
GET /api/resource/Customer?fields=["name","customer_name","customer_lat","customer_lng","last_visit_date","visit_frequency_days"]&filters=[["primary_sales_person","=","SP-0001"],["disabled","=",0]]
```

### Get Dashboard Stats for a Rep

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_dashboard_stats
{ "sales_person": "SP-0001" }
```

**Returns:**

```json
{
  "today_visits": 4,
  "scheduled_visits": 2,
  "active_visit": "Al Rahma Trading",
  "inventory_items": 12
}
```

### Get Nearby Customers

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_nearby_customers
{
  "sales_person": "SP-0001",
  "latitude": 24.688,
  "longitude": 46.722,
  "radius_km": 5
}
```

**Returns:** Top 10 nearest customers within radius, sorted by distance. Each record: `name`, `customer_name`, `customer_lat`, `customer_lng`, `distance_km`, `last_visit_date`, `primary_sales_person`.

### Get Today's Schedule for Rep

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_todays_schedule
{ "sales_person": "SP-0001" }
```

**Returns:** List of today's visits sorted by status priority (In Progress first), with `visit_id`, `customer`, `visit_status`, `visit_type`, `check_in_time`, `check_out_time`.

### Get Sales Person from User

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.get_sales_person_for_user
```

Returns `{ "sales_person": "SP-0001", "sales_person_name": "Ahmed" }` for the current logged-in user, or `null`.

---

## 11. Sales Person Visits

**DocType:** `Sales Person Visit`

### Key Fields

| Field                   | Type     | Description                                                                       |
|-------------------------|----------|-----------------------------------------------------------------------------------|
| `sales_person`          | Link     | Sales Person                                                                      |
| `customer`              | Link     | Customer being visited                                                            |
| `visit_date`            | Date     | Date of visit                                                                     |
| `visit_status`          | Select   | `Scheduled` / `In Progress` / `Completed` / `Cancelled`                          |
| `visit_type`            | Select   | `Sales Order` / `Follow-up` / `Stock Check` / `Product Return` / `No Order - Visit Only` |
| `check_in_time`         | Datetime | When rep checked in                                                               |
| `check_out_time`        | Datetime | When rep checked out                                                              |
| `visit_duration`        | Float    | Duration in hours (auto-calculated)                                               |
| `has_order`             | Check    | Whether a sales order was created                                                 |
| `sales_order`           | Link     | Linked Sales Order                                                                |
| `check_in_lat`          | Data     | Check-in GPS latitude                                                             |
| `check_in_lng`          | Data     | Check-in GPS longitude                                                            |
| `check_out_lat`         | Data     | Check-out GPS latitude                                                            |
| `check_out_lng`         | Data     | Check-out GPS longitude                                                           |
| `is_within_radius`      | Check    | Whether rep was within 50m of customer on check-in                               |
| `check_in_distance_meters` | Float | Distance from customer on check-in                                              |
| `notes`                 | Text     | Visit notes                                                                       |

### Status Flow

```
Scheduled → In Progress (check-in) → Completed (check-out)
                                    → Cancelled
```

Auto-checkout runs every 5 minutes for visits In Progress for more than 15 minutes with no activity.

### List Visits

```
GET /api/resource/Sales Person Visit?fields=["name","sales_person","customer","visit_date","visit_status","visit_type","check_in_time","check_out_time","visit_duration","has_order"]&filters=[["visit_date","=","2026-02-18"]]&order_by=check_in_time desc
```

### List Visits by Rep and Date Range

```
GET /api/resource/Sales Person Visit?filters=[["sales_person","=","SP-0001"],["visit_date",">=","2026-02-01"],["visit_date","<=","2026-02-28"]]&fields=["name","customer","visit_status","visit_duration","has_order","sales_order"]&order_by=visit_date desc
```

### Create Scheduled Visit (Admin)

```
POST /api/resource/Sales Person Visit
{
  "sales_person": "SP-0001",
  "customer": "CUST-0001",
  "visit_date": "2026-02-19",
  "visit_status": "Scheduled",
  "visit_type": "Sales Order"
}
```

### Check In (Admin Override)

```
POST /api/method/erpnext.selling.doctype.sales_person_visit.sales_person_visit.check_in
{
  "docname": "SPV-0001",
  "latitude": 24.688,
  "longitude": 46.722
}
```

**Returns:**

```json
{
  "status": "success",
  "distance": 32.5,
  "within_radius": true,
  "message": "Checked in successfully"
}
```

### Check Out (Admin Override)

```
POST /api/method/erpnext.selling.doctype.sales_person_visit.sales_person_visit.check_out
{
  "docname": "SPV-0001",
  "latitude": 24.689,
  "longitude": 46.723
}
```

**Returns:**

```json
{
  "status": "success",
  "duration": 1.5,
  "message": "Checked out successfully. Visit duration: 1.5 hours"
}
```

### Quick Check-in (Create + Check-in in One Step)

```
POST /api/method/erpnext.selling.page.sales_rep_dashboard.sales_rep_dashboard.quick_check_in
{
  "sales_person": "SP-0001",
  "customer": "CUST-0001",
  "latitude": 24.688,
  "longitude": 46.722
}
```

Returns `visit_name` of the newly created and checked-in visit.

### Create Sales Order from Visit

```
POST /api/method/erpnext.selling.doctype.sales_person_visit.sales_person_visit.make_sales_order
{ "source_name": "SPV-0001" }
```

Returns unsaved Sales Order pre-filled with customer from the visit.

### Cancel a Visit

```
PUT /api/resource/Sales Person Visit/SPV-0001
{ "visit_status": "Cancelled" }
```

---

## 12. Daily Route Plans

**DocType:** `Daily Route Plan`

### Key Fields

| Field                | Type     | Description                                     |
|----------------------|----------|-------------------------------------------------|
| `route_date`         | Date     | Planned date                                    |
| `sales_person`       | Link     | Assigned sales rep                              |
| `territory`          | Link     | Territory                                       |
| `status`             | Select   | `Draft` / `Active` / `Completed` / `Cancelled`  |
| `customers`          | Table    | Route Plan Customer rows                        |
| `total_customers`    | Int      | Total planned stops                             |
| `visited_customers`  | Int      | Completed stops (auto-updated)                  |
| `pending_customers`  | Int      | Remaining stops                                 |

### Status Flow

```
Draft → Active (on submit, auto-creates Scheduled visits)
      → Completed / Cancelled
```

On submit, a `Sales Person Visit` (status `Scheduled`) is auto-created for each customer in the plan.

### List Route Plans

```
GET /api/resource/Daily Route Plan?fields=["name","route_date","sales_person","status","total_customers","visited_customers"]&filters=[["status","in","Active,Draft"]]&order_by=route_date desc
```

### Create Route Plan

```
POST /api/resource/Daily Route Plan
{
  "route_date": "2026-02-19",
  "sales_person": "SP-0001",
  "territory": "Riyadh",
  "customers": [
    { "customer": "CUST-0001", "visit_sequence": 1 },
    { "customer": "CUST-0002", "visit_sequence": 2 }
  ]
}
```

### Submit Route Plan (Activates + Creates Visits)

```
POST /api/method/frappe.client.submit
{ "doc": { "doctype": "Daily Route Plan", "name": "DRP-0001" } }
```

### Get Suggested Customers for a Rep

```
POST /api/method/erpnext.selling.doctype.daily_route_plan.daily_route_plan.get_suggested_customers
{
  "sales_person": "SP-0001",
  "route_date": "2026-02-19",
  "territory": "Riyadh",
  "include_due": true,
  "max_distance_km": 20
}
```

**Returns:** List of suggested customers sorted by priority, each with `name`, `customer_name`, `customer_lat`, `customer_lng`, `last_visit_date`, `visit_frequency_days`, `days_since_visit`, `priority` (`"High"` or `"Medium"`).

**Priority Logic:**
- `"High"` — overdue by more than 20% of the frequency, or never visited
- `"Medium"` — due soon

### Update Visit Status in Plan

```
POST /api/resource/Daily Route Plan/DRP-0001
{ "run_method": "update_visit_status" }
```

Syncs all child-row visit statuses from the actual `Sales Person Visit` docs.

---

## 13. Route Map

The route map provides a real-time view of a rep's daily movement with all visit stops and GPS-calculated travel distance.

### Get Route Data

```
POST /api/method/erpnext.selling.page.sales_route_map.sales_route_map.get_route_data
{
  "sales_person": "SP-0001",
  "date": "2026-02-18",
  "current_lat": 24.688,
  "current_lng": 46.722
}
```

**Returns:**

```json
{
  "route_points": [
    {
      "type": "current",
      "name": "موقعك الحالي",
      "latitude": 24.688,
      "longitude": 46.722,
      "status": "current"
    },
    {
      "type": "visit",
      "name": "Al Rahma Trading",
      "latitude": 24.695,
      "longitude": 46.730,
      "status": "Completed",
      "visit_id": "SPV-0001",
      "customer": "CUST-0001",
      "check_in_time": "2026-02-18 09:00:00",
      "check_out_time": "2026-02-18 09:45:00"
    }
  ],
  "total_distance": 12.4,
  "total_visits": 5,
  "sales_person": "SP-0001",
  "date": "2026-02-18"
}
```

Use `route_points` to render a map with pins and a polyline connecting them in order.

---

## 14. Sales Route Analytics

**DocType:** `Sales Route Analytics`

### Key Fields / Metrics

| Field                    | Type    | Description                                           |
|--------------------------|---------|-------------------------------------------------------|
| `sales_person`           | Link    | Sales Person                                          |
| `date`                   | Date    | Analytics date                                        |
| `total_visits`           | Int     | All visits for the day                                |
| `completed_visits`       | Int     | Visits with check-out                                 |
| `total_distance_km`      | Float   | GPS-tracked route distance                            |
| `actual_distance_km`     | Float   | Actual travel distance                                |
| `planned_distance_km`    | Float   | Expected distance from route plan                     |
| `average_speed_kmh`      | Float   | Average moving speed                                  |
| `route_efficiency_score` | Float   | 0–100 composite score                                 |
| `visits`                 | Table   | `Sales Route Analytics Visit` child records           |

### Efficiency Score Formula

$$\text{Score} = 0.4 \times \text{completion\_rate} + 0.2 \times \text{distance\_efficiency} + 0.2 \times \text{time\_efficiency} + 0.2 \times \text{speed\_efficiency}$$

### List Analytics (Admin Dashboard)

```
GET /api/resource/Sales Route Analytics?fields=["name","sales_person","date","total_visits","completed_visits","route_efficiency_score","total_distance_km"]&filters=[["date",">=","2026-02-01"]]&order_by=date desc
```

### Get Analytics for a Rep

```
GET /api/resource/Sales Route Analytics?filters=[["sales_person","=","SP-0001"],["date","=","2026-02-18"]]&fields=["name","total_visits","completed_visits","route_efficiency_score","total_distance_km","average_speed_kmh"]
```

### Create / Update Daily Analytics (Bulk)

```
POST /api/method/erpnext.selling.doctype.sales_route_analytics.sales_route_analytics.create_daily_route_analytics
```

No parameters needed. Creates or updates `Sales Route Analytics` for **all** reps who had visits today.

**Returns:**

```json
{ "created": 3, "updated": 2, "message": "Processed 5 sales persons" }
```

### Recalculate Metrics for One Day

```
POST /api/resource/Sales Route Analytics/SRA-0001
{ "run_method": "recalculate_metrics" }
```

---

## 15. Discount Permission Profiles

**DocType:** `Discount Permission Profile`

### Key Fields

| Field              | Type    | Description                                              |
|--------------------|---------|----------------------------------------------------------|
| `profile_name`     | Data    | Display name                                             |
| `description`      | Text    | Notes                                                    |
| `is_active`        | Check   | Whether the profile is in use                            |
| `permission_rules` | Table   | Child table of `Discount Permission Rule`                |

### Discount Permission Rule (Child Table)

| Field                      | Type    | Description                                              |
|----------------------------|---------|----------------------------------------------------------|
| `scope`                    | Select  | `Item` / `Invoice`                                       |
| `discount_type`            | Select  | `Percentage` / `Amount`                                  |
| `max_discount_percent`     | Float   | Maximum allowed without approval                         |
| `max_discount_amount`      | Float   | Maximum allowed amount without approval                  |
| `requires_approval_above`  | Float   | Threshold above which approval is needed                 |
| `approval_role`            | Link    | Role that can approve                                    |
| `approval_expiry_hours`    | Float   | How long an approval request stays valid (default 24h)  |
| `allow_cumulative`         | Check   | Whether multiple discounts can stack                     |

### List Profiles

```
GET /api/resource/Discount Permission Profile?fields=["name","profile_name","is_active"]&filters=[["is_active","=",1]]
```

### Create Profile

```
POST /api/resource/Discount Permission Profile
{
  "profile_name": "Standard Field Rep",
  "is_active": 1,
  "description": "For regular field sales representatives",
  "permission_rules": [
    {
      "scope": "Invoice",
      "discount_type": "Percentage",
      "max_discount_percent": 10,
      "requires_approval_above": 5,
      "approval_role": "Sales Manager",
      "approval_expiry_hours": 24,
      "allow_cumulative": 0
    },
    {
      "scope": "Item",
      "discount_type": "Percentage",
      "max_discount_percent": 15,
      "requires_approval_above": 8,
      "approval_role": "Sales Manager",
      "approval_expiry_hours": 12
    }
  ]
}
```

### Assign Profile to Sales Rep

```
PUT /api/resource/Sales Person/SP-0001
{ "discount_permission_profile": "Standard Field Rep" }
```

---

## 16. Discount Approval Requests

**DocType:** `Discount Approval Request`

### Key Fields

| Field                       | Type     | Description                                              |
|-----------------------------|----------|----------------------------------------------------------|
| `sales_person`              | Link     | Requesting sales rep                                     |
| `customer`                  | Link     | Customer on the sale                                     |
| `sales_invoice`             | Link     | Linked invoice (if applicable)                           |
| `request_date`              | Datetime | When request was submitted                               |
| `status`                    | Select   | `Pending` / `Approved` / `Rejected` / `Expired`          |
| `discount_scope`            | Select   | `Item` / `Invoice`                                       |
| `discount_type`             | Select   | `Percentage` / `Amount`                                  |
| `requested_discount_percent`| Float    | Requested % discount                                     |
| `requested_discount_amount` | Float    | Requested amount discount                                |
| `item_code`                 | Link     | Specific item (if item-scope)                            |
| `original_rate`             | Float    | Item's original rate                                     |
| `discounted_rate`           | Float    | Rate after discount                                      |
| `justification`             | Text     | Rep's reason for discount                                |
| `approved_by`               | Link     | User who approved                                        |
| `approval_date`             | Datetime | When approved/rejected                                   |
| `approval_notes`            | Text     | Approver's notes                                         |
| `expires_at`                | Datetime | Auto-expires after profile's `approval_expiry_hours`     |

### Status Flow

```
Pending → Approved (by approve_request)
        → Rejected (by reject_request)
        → Expired  (auto on save if past expires_at)
```

### List All Pending Approvals (Admin Queue)

```
POST /api/method/erpnext.selling.doctype.discount_approval_request.discount_approval_request.get_pending_approvals
```

**Returns:** List of pending requests with `name`, `sales_person`, `customer`, `discount_type`, `requested_discount_percent`, `requested_discount_amount`, `justification`, `request_date`, `expires_at`.

### List by Status

```
GET /api/resource/Discount Approval Request?fields=["name","sales_person","customer","status","discount_type","requested_discount_percent","request_date","expires_at"]&filters=[["status","=","Pending"]]&order_by=request_date asc
```

### Get Single Request

```
GET /api/resource/Discount Approval Request/DAR-0001
```

### Approve a Request

```
POST /api/method/erpnext.selling.doctype.discount_approval_request.discount_approval_request.approve_request
{
  "request_name": "DAR-0001",
  "notes": "Approved for loyalty customer"
}
```

**Returns:** `"DAR-0001"` (the request name).

### Reject a Request

```
POST /api/method/erpnext.selling.doctype.discount_approval_request.discount_approval_request.reject_request
{
  "request_name": "DAR-0001",
  "notes": "Exceeds allowable margin for this product category"
}
```

---

## 17. Discount Validation Engine

These endpoints are called by the mobile rep app and also useful in the admin panel for manual override scenarios.

### Validate a Discount

```
POST /api/method/erpnext.selling.discount_validation.validate_discount_permission
{
  "sales_person": "SP-0001",
  "customer": "CUST-0001",
  "discount_type": "Percentage",
  "discount_value": 8.0,
  "scope": "Item",
  "item_code": "ITEM-001",
  "original_rate": 200.00
}
```

**Returns:**

```json
{
  "valid": true,
  "requires_approval": false,
  "max_allowed": 10.0,
  "message": "Discount is within allowed limits"
}
```

OR when approval needed:

```json
{
  "valid": false,
  "requires_approval": true,
  "max_allowed": 10.0,
  "message": "Discount exceeds auto-approval threshold. Request submitted.",
  "approval_role": "Sales Manager",
  "approval_threshold": 5.0
}
```

> **Note:** Rate limited to 30 requests / 60 seconds per sales person. All attempts are logged with IP address for audit.

### Submit an Approval Request

```
POST /api/method/erpnext.selling.discount_validation.request_discount_approval
{
  "sales_person": "SP-0001",
  "customer": "CUST-0001",
  "discount_type": "Percentage",
  "discount_value": 18.0,
  "scope": "Invoice",
  "justification": "Long-term customer with annual volume commitment",
  "sales_invoice": "SINV-0001"
}
```

**Returns:**

```json
{
  "success": true,
  "request_name": "DAR-0001",
  "message": "Approval request submitted. Approvers have been notified."
}
```

### Check Approval Status

```
POST /api/method/erpnext.selling.discount_validation.check_approval_status
{ "request_name": "DAR-0001" }
```

**Returns:**

```json
{
  "status": "Approved",
  "approved_by": "manager@company.com",
  "approval_date": "2026-02-18 11:30:00",
  "approval_notes": "Approved for loyalty customer",
  "expires_at": "2026-02-19 09:00:00"
}
```

### Validate Cumulative Discounts (Anti-stacking)

```
POST /api/method/erpnext.selling.discount_validation.calculate_effective_discount
{
  "discounts_data": [
    { "type": "Percentage", "value": 10 },
    { "type": "Percentage", "value": 5 }
  ]
}
```

**Returns:**

```json
{
  "total_percent": 14.5,
  "total_amount": 0,
  "is_valid": true
}
```

If cumulative discounts exceed 100%, `is_valid` is `false` and suspicious activity is logged.

---

## 18. Sales Rep Inventory

**DocType:** `Sales Rep Inventory`

Manages stock loaded into / unloaded from a rep's van warehouse.

### Key Fields

| Field                 | Type     | Description                                             |
|-----------------------|----------|---------------------------------------------------------|
| `sales_person`        | Link     | Sales Person                                            |
| `warehouse`           | Link     | Rep's van warehouse                                     |
| `transaction_type`    | Select   | `Load` / `Unload` / `Adjustment` / `Transfer`           |
| `source_warehouse`    | Link     | Source warehouse (for Load/Unload)                      |
| `items`               | Table    | Sales Rep Inventory Item rows                           |
| `total_items`         | Float    | Total quantity                                          |
| `total_value`         | Currency | Total value                                             |
| `stock_entry`         | Link     | Auto-created Stock Entry on submit                      |
| `posting_date`        | Date     | Transaction date                                        |

### Transaction Types → Stock Entry Behavior

| Type         | Stock Entry Purpose | Movement                           |
|--------------|---------------------|------------------------------------|
| `Load`       | Material Transfer   | Main warehouse → Rep's warehouse   |
| `Unload`     | Material Transfer   | Rep's warehouse → Main warehouse   |
| `Adjustment` | Material Receipt    | Directly into rep's warehouse      |
| `Transfer`   | None                | Record-only, no stock movement     |

### List Inventory Transactions for Rep

```
GET /api/resource/Sales Rep Inventory?fields=["name","sales_person","transaction_type","posting_date","total_value","stock_entry"]&filters=[["sales_person","=","SP-0001"]]&order_by=posting_date desc
```

### Create Load Transaction (Stock Transfer to Van)

```
POST /api/resource/Sales Rep Inventory
{
  "sales_person": "SP-0001",
  "transaction_type": "Load",
  "posting_date": "2026-02-18",
  "source_warehouse": "Stores - MC",
  "items": [
    { "item_code": "ITEM-001", "qty": 50, "rate": 100 },
    { "item_code": "ITEM-002", "qty": 30, "rate": 200 }
  ]
}
```

### Submit (Creates Stock Entry Automatically)

```
POST /api/method/frappe.client.submit
{ "doc": { "doctype": "Sales Rep Inventory", "name": "SRI-0001" } }
```

### Populate Items from Rep's Current Warehouse Stock

```
POST /api/resource/Sales Rep Inventory/SRI-0001
{ "run_method": "get_items_from_warehouse" }
```

Populates `items` from current stock ledger entries in the rep's warehouse.

### View Rep's Current Van Stock (Report)

```
GET /api/method/frappe.desk.query_report.run
{
  "report_name": "Sales Rep Inventory Summary",
  "filters": { "sales_person": "SP-0001" }
}
```

**Returns:** Columns: `sales_person`, `warehouse`, `item_code`, `item_name`, `qty`, `rate`, `value`.

---

## 19. Customer Inventory Records

**DocType:** `Customer Inventory Record`

Tracks stock held at a customer's premises.

### Key Fields

| Field          | Type  | Description                               |
|----------------|-------|-------------------------------------------|
| `customer`     | Link  | Customer                                  |
| `sales_person` | Link  | Rep who recorded the inventory            |
| `record_date`  | Date  | When the stock check was done             |
| `visit`        | Link  | Linked Sales Person Visit                 |
| `items`        | Table | `Customer Inventory Item` rows            |
| `total_items`  | Int   | Number of distinct items                  |

### List Inventory Records for Customer

```
GET /api/resource/Customer Inventory Record?fields=["name","customer","sales_person","record_date","total_items"]&filters=[["customer","=","CUST-0001"]]&order_by=record_date desc
```

### Create Inventory Record

```
POST /api/resource/Customer Inventory Record
{
  "customer": "CUST-0001",
  "sales_person": "SP-0001",
  "record_date": "2026-02-18",
  "visit": "SPV-0001",
  "items": [
    { "item_code": "ITEM-001", "qty_at_customer": 10 },
    { "item_code": "ITEM-002", "qty_at_customer": 5 }
  ]
}
```

On save: `Customer.last_inventory_check` is automatically updated.

---

## 20. Product Returns from Customers

**DocType:** `Product Return From Customer`

### Key Fields

| Field              | Type     | Description                                                   |
|--------------------|----------|---------------------------------------------------------------|
| `return_date`      | Date     | Date of return                                               |
| `return_time`      | Time     | Time of return                                               |
| `sales_person`     | Link     | Collecting rep                                               |
| `customer`         | Link     | Returning customer                                           |
| `visit`            | Link     | Linked visit                                                  |
| `return_reason`    | Select   | `Damaged` / `Expired` / `Wrong Product` / `Quality Issue` / `Other` |
| `items`            | Table    | `Product Return Item` rows                                   |
| `total_qty`        | Float    | Total returned quantity                                      |
| `total_amount`     | Currency | Total value of returned items                                |
| `stock_entry`      | Link     | Auto-created on submit (Material Receipt into rep's warehouse) |
| `processed`        | Check    | Whether the return is fully processed                        |
| `sales_invoice`    | Link     | Original sales invoice reference                             |

### Status Flow

```
Draft → Submitted (creates Stock Entry: Material Receipt into rep's warehouse)
```

### List Returns

```
GET /api/resource/Product Return From Customer?fields=["name","customer","sales_person","return_date","return_reason","total_qty","total_amount","processed"]&order_by=return_date desc
```

### Create Return

```
POST /api/resource/Product Return From Customer
{
  "return_date": "2026-02-18",
  "sales_person": "SP-0001",
  "customer": "CUST-0001",
  "return_reason": "Expired",
  "items": [
    {
      "item_code": "ITEM-001",
      "qty": 5,
      "rate": 100.00,
      "batch_no": "BATCH-001"
    }
  ]
}
```

### Submit Return (Creates Stock Entry)

```
POST /api/method/frappe.client.submit
{ "doc": { "doctype": "Product Return From Customer", "name": "PRC-0001" } }
```

On submit: A `Stock Entry` (type: Material Receipt) is created into the rep's `inventory_warehouse`. The rep must have `has_inventory = 1` and `inventory_warehouse` set.

---

## 21. Reports

All reports are accessible via:

```
GET /api/method/frappe.desk.query_report.run?report_name={Report Name}&filters={JSON}
```

### Customer Visit History

```
GET /api/method/frappe.desk.query_report.run
  ?report_name=Customer Visit History
  &filters={"customer":"CUST-0001","from_date":"2026-01-01","to_date":"2026-02-28"}
```

**Columns:** Visit ID, Date, Customer, Sales Person, Visit Type, Status, Check In, Check Out, Duration (min), Sales Order, Order Value.

**Available Filters:** `sales_person`, `customer`, `from_date`, `to_date`, `visit_status`.

---

### Sales Person Daily Activity

```
GET /api/method/frappe.desk.query_report.run
  ?report_name=Sales Person Daily Activity
  &filters={"sales_person":"SP-0001","from_date":"2026-02-01","to_date":"2026-02-28"}
```

**Columns:** Sales Person, Date, Total Visits, Completed, In Progress, Scheduled, Cancelled, Total Duration (hrs), Orders Created, Order Value.

**Available Filters:** `sales_person`, `from_date`, `to_date`.

---

### Sales Rep Inventory Summary

```
GET /api/method/frappe.desk.query_report.run
  ?report_name=Sales Rep Inventory Summary
  &filters={"sales_person":"SP-0001"}
```

**Columns:** Sales Person, Warehouse, Item Code, Item Name, Qty, Rate, Value.

**Available Filters:** `sales_person`, `warehouse`.

---

### Sales Person Commission Summary

```
GET /api/method/frappe.desk.query_report.run
  ?report_name=Sales Person Commission Summary
  &filters={"sales_person":"SP-0001","fiscal_year":"2026"}
```

---

### Sales Person Wise Transaction Summary

```
GET /api/method/frappe.desk.query_report.run
  ?report_name=Sales Person-wise Transaction Summary
  &filters={"doctype":"Sales Invoice","from_date":"2026-01-01","to_date":"2026-02-28"}
```

---

### Sales Funnel (Pipeline Overview)

```
GET /api/method/erpnext.selling.page.sales_funnel.sales_funnel.get_funnel_data
{
  "from_date": "2026-01-01",
  "to_date": "2026-02-28",
  "company": "My Company"
}
```

**Returns:** Counts and amounts at each pipeline stage: Leads → Opportunities → Quotations → Sales Orders.

---

## 22. File Upload

Attach documents or images to any record (e.g., visit photos, return receipts).

```
POST /api/method/upload_file
Content-Type: multipart/form-data

file: <binary>
doctype: Sales Person Visit
docname: SPV-0001
fieldname: (optional field to set on the doc)
is_private: 1
```

**Returns:**

```json
{
  "message": {
    "name": "FILE-0001",
    "file_name": "receipt.jpg",
    "file_url": "/private/files/receipt.jpg"
  }
}
```

---

## Error Handling

All Frappe API responses follow this structure:

**Success:**

```json
{ "data": { ... } }
```

**Error:**

```json
{
  "exception": "frappe.exceptions.ValidationError",
  "exc_type": "ValidationError",
  "_server_messages": "[{\"message\": \"...\"}]"
}
```

### Common HTTP Status Codes

| Code | Meaning                                        |
|------|------------------------------------------------|
| 200  | Success                                        |
| 400  | Validation error or bad request                |
| 401  | Not authenticated — redirect to login          |
| 403  | Permission denied                              |
| 404  | Document not found                             |
| 417  | Server-side exception (check `exception` field)|

### Recommended Next.js Pattern

```ts
async function callApi(method: string, params: object) {
  const res = await fetch(`/api/method/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Frappe-CSRF-Token": getCsrfToken(),
    },
    body: JSON.stringify(params),
  });

  const json = await res.json();

  if (!res.ok || json.exception) {
    const msg = JSON.parse(json._server_messages || "[]")[0]?.message;
    throw new Error(msg || json.exception || "Unknown error");
  }

  return json.message ?? json.data;
}
```

---

## Doctype Reference Summary

| Module                        | DocType                        | Key Operations                              |
|-------------------------------|--------------------------------|---------------------------------------------|
| Customer Management           | `Customer`                     | CRUD, assign rep, GPS coords, visit tracking |
| Sales Pipeline                | `Quotation`                    | CRUD, convert to SO, mark lost              |
| Sales Pipeline                | `Sales Order`                  | CRUD, submit, create DN/SI/PO, close        |
| Billing                       | `Sales Invoice`                | CRUD, submit, return, payment               |
| Payments                      | `Payment Entry`                | Create from invoice, submit                 |
| Catalog                       | `Item`                         | Read, get details, pricing                  |
| Pricing                       | `Pricing Rule`                 | Apply, remove, manage                       |
| Sales Reps                    | `Sales Person`                 | CRUD, assign profile, location              |
| Field Visits                  | `Sales Person Visit`           | CRUD, check-in, check-out, convert to SO    |
| Route Planning                | `Daily Route Plan`             | CRUD, submit (auto-creates visits)          |
| Route Visualization           | `Sales Route Map` (page)       | Read-only route data                        |
| Route Analytics               | `Sales Route Analytics`        | Read, recalculate                           |
| Discount Control              | `Discount Permission Profile`  | CRUD, assign to reps                        |
| Discount Queue                | `Discount Approval Request`    | Read queue, approve, reject                 |
| Van Stock                     | `Sales Rep Inventory`          | CRUD, load/unload, submit (creates SE)      |
| Customer Stock Check          | `Customer Inventory Record`    | CRUD                                        |
| Returns                       | `Product Return From Customer` | CRUD, submit (creates SE)                   |
