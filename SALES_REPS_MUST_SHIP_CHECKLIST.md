# Sales-Reps Vertical — MUST-SHIP CHECKLIST (STEP 0)

Date: 2026-07-09 · Status: reference-verified on **qarawi** (working tenant); canary **salescanary** provisioning awaits operator approval.
Scope: everything a **sales-only client site** needs for the complete, working sales-reps package (admin dashboard + rep PWA), end to end.

Legend: ✅ = verified present on the qarawi reference (read-only probe) · ⏳ = verify on canary once provisioned · ⚠️ = gap found, action needed for the deliverable.

## 1. Apps that MUST be installed on the tenant site

| # | App | Why | Status |
|---|-----|-----|--------|
| 1.1 | `frappe` | framework | ✅ provisioner installs |
| 1.2 | `erpnext` (this fork) | **LOAD-BEARING**: Selling/Stock/Accounts engines — SO→DN→SI chain, Stock Entries, Bin/SLE, GL. The custom sales doctypes live inside it (`erpnext/selling/doctype/*`). Verdict from dependency map: the vertical *creates and submits* ERPNext documents and rides their ledger side effects; it cannot run without it. Keep installed, hide from UI. | ✅ provisioner installs |
| 1.3 | `hrms` | NOT needed by sales logic, but base_meena's `after_migrate` runs 3 **unguarded** HR steps (Shift Type / Leave Type / Leave Application = hrms-only doctypes) → `bench migrate` fails without it. Keep installed until base_meena guards land. (Employee itself is erpnext-owned in this fork — fine.) | ✅ provisioner installs |
| 1.4 | `base_meena` | Wallet + Wallet Transaction, Stock Transfer Request, van-warehouse automation, zatca_api wrapper, permission setup, VAT/Mode-of-Payment seeding | ✅ provisioner installs |
| 1.5 | `zatca_erpgulf` | **⚠️ GAP — the provisioner does NOT install it.** `base_meena.zatca_api.*` (used by the invoice ZATCA status/QR in the PWA + admin) does lazy `from zatca_erpgulf...` imports — ZATCA endpoints 500 without it. qarawi has it **manually** installed (v3.0). → Canary (and any sales tenant) must `bench --site <site> install-app zatca_erpgulf`; longer-term add it to `site_creator/api.py`. | ⚠️ manual step |
| 1.6 | `domain_manager`, `zkteco_checkins_sync` | installed by provisioner; harmless for sales (zkteco is HR-side) | ✅ provisioner installs |

Explicitly NOT needed: `hr_custom`, `car_marketplace`, `site_guard`, `tenant_manager`, `site_creator` (hub-only).

## 2. Custom doctypes (all must exist as tables after migrate)

| # | Doctype | Home | Status |
|---|---------|------|--------|
| 2.1 | Sales Person Visit (+ submit/cancel, GPS radius validation) | erpnext/selling | ✅ (55 rows on qarawi) |
| 2.2 | Daily Route Plan + Route Plan Customer (on_submit → auto-creates visits) | erpnext/selling | ✅ (4 rows) |
| 2.3 | Sales Rep Inventory + Item (on_submit → Stock Entry) | erpnext/selling | ⏳ |
| 2.4 | Sales Route Analytics + Visit child | erpnext/selling | ✅ (cron generates) |
| 2.5 | Discount Approval Request / Permission Profile / Permission Rule | erpnext/selling | ⏳ tables exist via migrate |
| 2.6 | Wallet + Wallet Transaction (shadow ledger, no GL) | base_meena/wallet | ✅ (11 / 23 rows) |
| 2.7 | Stock Transfer Request + Item (accept → Stock Entry) | base_meena/stock_management | ✅ (3 rows) |
| 2.8 | Customer Inventory Record, Product Return From Customer, Return Log, Free Sample Allocation/Distribution | erpnext/selling + base_meena/stock_management | ⏳ |

## 3. ERPNext core dependencies (kept, hidden from UI)

Customer, Sales Order, Delivery Note, Sales Invoice (+ ZATCA hooks), Payment Entry, Stock Entry, Warehouse (+ per-rep Van), Bin, Stock Ledger Entry, Batch/Serial No, Item, Sales Person, Sales Taxes and Charges Template, Territory, Company, Employee (erpnext-owned in this fork), Mode of Payment.
- ✅ qarawi: 6 Modes of Payment, 3 VAT templates, Van warehouses exist and are linked (`custom_linked_sales_person`).
- Mappers used at runtime: `make_sales_order`, `make_delivery_note`, `make_sales_invoice`, `get_payment_entry` — ship with erpnext. ⏳ smoke-test on canary.

## 4. Custom fields

| # | Field set | Mechanism | Status |
|---|-----------|-----------|--------|
| 4.1 | Customer tracking (customer_lat/lng, primary_sales_person, last_visit_date/by, visit_frequency_days, customer_inventory_tracked) | **baked into fork JSON** → arrive with migrate | ✅ columns confirmed |
| 4.2 | Sales Person (mobile_app_user, has_inventory, inventory_warehouse, current_location_lat/lng, location_last_updated) | baked into fork JSON | ✅ columns confirmed |
| 4.3 | Warehouse (custom_warehouse_type, custom_linked_sales_person, custom_is_dynamic) | `create_custom_fields` in base_meena after_migrate | ✅ confirmed |
| 4.4 | Discount fields on SI/SO/Quotation/Sales Person (total_discount_given, discount_permission_profile, bypass_discount_limits, …) | `erpnext/selling/custom_fields/discount_permission_fields.py` — **⚠️ NOT WIRED to any hook; absent even on qarawi.** Discount-approval engine is inert without a manual run. Decision needed: run it on sales tenants, or accept engine-off (PWA folds discounts into rates anyway). | ⚠️ unwired |

## 5. Whitelisted API surface (frontend → backend contract)

- `sales_person_visit.check_in / check_out / delete_visit / make_sales_order` ⏳
- `daily_route_plan.get_suggested_customers` ⏳
- `discount_approval_request.approve_request / reject_request / get_pending_approvals` ⏳
- `sales_route_analytics.create_daily_route_analytics` ⏳
- pages: `sales_rep_dashboard.get_dashboard_stats / get_nearby_customers / get_todays_schedule / quick_check_in / update_sales_person_location`; `sales_route_map.get_route_data` ⏳
- base_meena: `stock_transfer_request.accept/reject/get_pending_requests_for_sales_person`, `stock_validation.get_salesperson_stock / check_item_availability`, `warehouse_management.update_sales_person / delete_sales_person`, `wallet.wallet_api.*` (get_my_wallet, credit_sales_wallet, top_up, transfer, summary), `zatca_api.*` (needs app 1.5), `employee_documents_api.*` (PWA profile) ⏳
- generic: `frappe.client.*`, `frappe.desk.query_report.run`, erpnext mappers (§3).
- ⚠️ **Known phantom**: `base_meena.stock_management.location_api.save_location` (GPS broadcaster's primary endpoint) **does not exist** — every ping 404s; fallback direct `PUT Sales Person` needs write perms only System Manager / Sales Master Manager have. Live rep tracking is broken for properly-scoped reps. Must be fixed or repointed (e.g. to `sales_rep_dashboard.update_sales_person_location`) in the deliverable.

## 6. Setup & automation

| # | Item | Status |
|---|------|--------|
| 6.1 | Setup wizard (Company, CoA, Item Group root) — provisioner runs it (company = subdomain) | ⏳ |
| 6.2 | `after_migrate`: `setup_sales_user_permissions` / `setup_sales_manager_permissions` (guarded, HR-tolerant), `setup_cash_mode_of_payment`, `setup_vat_for_all_companies`, `setup_account_names`, stock custom fields, product import | ✅ on qarawi · ⏳ canary |
| 6.3 | Van-warehouse automation: Sales Person after_insert/on_update → `create_van_warehouse_for_sales_person` (needs Company + Warehouse tree only) | ✅ Van warehouses exist on qarawi |
| 6.4 | Cron: `auto_check_out_visits` (*/5 min) — registered + enabled | ✅ (`stopped: 0`) |
| 6.5 | Cron: `create_daily_route_analytics` (daily) — registered + enabled | ✅ (`stopped: 0`) |
| 6.6 | Roles present: Sales User, Sales Manager, Sales Master Manager, Stock User, Stock Manager (+ Employee Self Service pre-created by provisioner) | ✅ |
| 6.7 | Rep identity chain: User account + (Employee with user_id) → Sales Person.employee, **or** Sales Person.mobile_app_user; `enabled=1`; `has_inventory=1` → van warehouse | ⏳ seeded on canary |

## 7. Frontend / PWA (served by the shared next-server for every vhost)

| # | Item | Status |
|---|------|--------|
| 7.1 | Admin dashboard `/sales-reps` (+ second admin page `/admin/sales` for orders/quotes/invoices/returns/discounts) | ✅ code in prod build |
| 7.2 | PWA `/sales-rep/*`: 13 screens + `sales-rep/layout.tsx` (auth gate + SW registration + GPS broadcaster + custody banner) | ✅ code in prod build |
| 7.3 | PWA assets: `public/sales-rep-manifest.json`, `public/sales-rep-sw.js` (scope `/sales-rep`), icons (192/512 + maskable), install prompt; next.config headers (`Service-Worker-Allowed`, `Permissions-Policy: geolocation=(self)`) | ✅ files present |
| 7.4 | Shared shell the vertical rides on: `(erp)/layout.tsx` Providers (I18n + Auth/frappeClient), ui/* primitives, `SalesRepContext`, `sales-api/stock-api/wallet-api/zatca-api` | ✅ |
| 7.5 | Tenant vhost: nginx conf (from `build_tenant_nginx_conf`) + TLS cert + `X-Frappe-Site-Name` routing + `/_next/static` alias | ⏳ created by provisioner |
| 7.6 | ⚠️ Known PWA bug (carry into deliverable fix-list): `/sales-rep/my-map` infinite loader for users with no linked Sales Person (ignores context error state) | ⚠️ |

## 8. E2E acceptance (canary) — "a rep can actually work"

| # | Flow | Expected |
|---|------|----------|
| E1 | Rep login to PWA (`/sales-rep`) as seeded rep user | home renders, no "غير مصرح" |
| E2 | Customers visible (primary_sales_person = rep) | ≥1 customer card |
| E3 | Create visit + GPS check-in (`createVisit` + `check_in`) | Visit In Progress, coords stored, radius flag computed |
| E4 | New order → SO → DN (submitted, stock deducted from van) → SI (submitted) | full chain docstatus=1; Bin qty drops |
| E5 | ZATCA on the SI | `zatca_api.get_invoice_zatca_status` responds (app installed); QR field/print format present |
| E6 | Payment: Payment Entry against SI + `credit_sales_wallet` | PE submitted; Wallet Transaction credit + company debit |
| E7 | Check-out (`check_out`) | visit Completed, duration computed; Customer.last_visit_date stamped |
| E8 | Admin `/sales-reps` stat cards | live counts reflect E3–E6 |
| E9 | Discount landmine characterization: (a) rate-folded discount → passes; (b) customer-credit deduction (additional_discount_amount → SI discount_amount) → either passes or throws "Sales Person is required in Sales Team" / "Discount Not Allowed" (fields unwired). Record actual behavior. | documented outcome |
| E10 | Crons: force-run `auto_check_out_visits` + `create_daily_route_analytics` on canary | no exceptions; analytics row created |

## Blocking item

Canary provisioning (`site_creator.api.create_site_task` for `salescanary`) is ready but **requires operator approval** (auto-mode denies site-creation commands). Script: `scratchpad/provision-salescanary.sh` (admin password stashed alongside). After it completes: `bench --site salescanary install-app zatca_erpgulf && bench --site salescanary migrate`, then run §8.
