# Base Meena — Frontend

> ⭐ **المنتج الرئيسي · Featured product — [تمكين العقارية · Tamkeen Real Estate](docs/STOREFRONT.md)**
> سوق عقاري سعودي متوافق مع REGA. واجهة السوق موثّقة في [دليل الواجهة](docs/STOREFRONT.md)، والقصّة الكاملة في [الملف الرئيسي](../apps/base_meena/base_meena/real_estate/README.md).
> *A REGA-compliant Saudi real-estate marketplace — storefront doc: [STOREFRONT.md](docs/STOREFRONT.md); full story in the [flagship README](../apps/base_meena/base_meena/real_estate/README.md).*

## Update Note

- 2026-04-29: Documented Accounting, Cashier (POS), Purchases, Tasks, Biometrics, and other new modules.

A multi-tenant enterprise management platform built with **Next.js 16 + React 19**, powering HR, Inventory, Sales, and Admin systems on top of **Frappe/ERPNext**.

> Each tenant gets its own subdomain (e.g. `qarawi.base.meena.sa`, `fayez.base.meena.sa`) with custom branding, while sharing the same frontend codebase deployed on Vercel.

---

## Table of Contents

- [Systems Overview](#systems-overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Authentication & Permissions](#authentication--permissions)
- [Multi-Tenant Configuration](#multi-tenant-configuration)
- [Setup Wizard](#setup-wizard)
- [System Modules](#system-modules)
  - [HR Management](#hr-management)
  - [Accounting](#accounting)
  - [Cashier (POS)](#cashier-pos)
  - [Inventory Management](#inventory-management)
  - [Purchases](#purchases)
  - [Tasks](#tasks)
  - [Sales Rep Portal](#sales-rep-portal)
  - [Admin Panel](#admin-panel)
- [Internationalization](#internationalization)
- [Tech Stack](#tech-stack)
- [API Proxy](#api-proxy)
- [Deployment](#deployment)
- [Testing](#testing)
- [Backend Apps](#backend-apps)
- [Cashier System — Audit Update (v3)](#cashier-system--audit-update-v3)

---

## Systems Overview

| System | Route | Description |
|--------|-------|-------------|
| **HR Management** | `/hr` | Employees, Attendance, Leaves, Payroll, Shifts, Biometrics, Auto Attendance |
| **Inventory Management** | `/inventory` | Warehouses, Products, Transfers, Returns, Audit Log, Reconciliation |
| **Accounting** | `/accounting` | Chart of Accounts, General Ledger, AR/AP Aging, P&L, Balance Sheet, Bank Reconciliation, VAT, Journal Entries, Trial Balance, Cash Flow, Period Closing, Purchase/Sales Invoices |
| **Cashier (POS)** | `/cashier` | Point-of-Sale checkout, Returns, History, Reports, Settings, Hold/Park transactions |
| **Purchases** | `/purchases` | Purchase orders and management |
| **Tasks** | `/tasks` | Task management and tracking |
| **Sales Rep Portal** | `/sales-rep` | Orders, Payments, Route Plans, Stock Requests (PWA-ready) |
| **Sales Reps & POS** | `/sales-reps` | Representatives management, Visits, Analytics |
| **Admin Panel** | `/admin` | Users, Roles, System Settings, Domains |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                    Browser                        │
│  Next.js App (React 19 + Tailwind + Radix UI)   │
└──────────────────┬───────────────────────────────┘
                   │ /api/frappe?path=...
                   ▼
┌──────────────────────────────────────────────────┐
│              Next.js API Proxy                    │
│  app/api/frappe/route.ts                         │
│  (Forwards cookies, resolves CORS)               │
└──────────────────┬───────────────────────────────┘
                   │ Same-domain backend
                   ▼
┌──────────────────────────────────────────────────┐
│          Frappe / ERPNext Backend                 │
│  base_meena app + hrms + hr_custom               │
│  (qarawi.base.meena.sa / fayez.base.meena.sa)   │
└──────────────────────────────────────────────────┘
```

The frontend derives the backend URL from the **current domain** at runtime — no hardcoded backend URL needed in production. Every request flows through the internal API proxy to handle CORS and cookie forwarding.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Access to a Frappe/ERPNext instance (e.g. `qarawi.base.meena.sa`)

### Installation

```bash
# Clone the repo
git clone https://github.com/naderyasser/base-meena-frontend.git
cd base-meena-frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm start
```

---

## Environment Variables

Create `.env.local` for local development:

```env
NEXT_PUBLIC_APP_NAME=Meena HR System
NEXT_PUBLIC_APP_VERSION=2.0.0

# Only needed for local dev (production derives URL from domain)
# NEXT_PUBLIC_FRAPPE_URL=https://qarawi.base.meena.sa
```

> In production, the backend URL is resolved automatically from the request domain — no env var required.

---

## Project Structure

```
├── app/
│   ├── page.tsx                     # Module Hub (home page)
│   ├── layout.tsx                   # Root layout (AuthProvider, I18n, ClientContext)
│   ├── login/                       # Login page
│   ├── setup-wizard/                # First-run company setup
│   ├── profile/                     # User profile
│   ├── (dashboard)/                 # Route group for authenticated pages
│   │   ├── hr/                      # HR dashboard
│   │   ├── employees/               # Employee list
│   │   ├── employee/[id]/           # Employee create/edit
│   │   ├── employee-details/[id]/   # Employee details view
│   │   ├── attendance/              # Attendance management
│   │   ├── auto-attendance/         # Automated attendance processing
│   │   ├── biometric/               # Biometric device integration
│   │   ├── branches/                # Branch management
│   │   ├── payroll/                 # Payroll system
│   │   ├── shift-management/        # Shift scheduling
│   │   ├── location-tracking/       # GPS location tracking
│   │   ├── radius-alerts/           # Geofence alerts
│   │   ├── hr-managers/             # Role/permission management
│   │   ├── hr-settings/             # HR settings
│   │   ├── employee-report/         # Employee reports
│   │   ├── inventory/               # Inventory management system
│   │   ├── accounting/              # Accounting system
│   │   │   ├── chart-of-accounts/
│   │   │   ├── general-ledger/
│   │   │   ├── ar-aging/
│   │   │   ├── ap-aging/
│   │   │   ├── pnl/                 # Profit & Loss
│   │   │   ├── balance-sheet/
│   │   │   ├── trial-balance/
│   │   │   ├── cash-flow/
│   │   │   ├── journal-entries/
│   │   │   ├── payment-entries/
│   │   │   ├── bank-reconciliation/
│   │   │   ├── purchase-invoices/
│   │   │   ├── sales-invoices/
│   │   │   ├── vat/
│   │   │   └── period-closing/
│   │   ├── purchases/               # Purchase management
│   │   ├── tasks/                   # Task management
│   │   ├── sales-reps/              # Sales reps management
│   │   └── admin/                   # System admin panel
│   ├── cashier/                     # Point-of-Sale system
│   │   ├── checkout/
│   │   ├── returns/
│   │   ├── history/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── close/
│   ├── sales-rep/                   # Sales rep portal (PWA)
│   │   ├── new-order/
│   │   ├── order-history/
│   │   ├── payments/
│   │   ├── route-plan/
│   │   ├── stock-requests/
│   │   ├── inventory-records/
│   │   ├── customer-inventory/
│   │   ├── invoice/
│   │   └── my-map/
│   └── api/
│       ├── frappe/                  # API proxy → Frappe backend
│       └── upload_file/             # File upload endpoint
│
├── components/
│   ├── inventory/
│   │   └── inventory-management.tsx # Full inventory system (4400+ lines)
│   ├── payroll/                     # Payroll components
│   ├── admin/                       # Admin panel components
│   ├── sales/                       # Sales components
│   ├── ui/                          # Shared UI (Radix/shadcn)
│   ├── dashboard.tsx                # Main dashboard
│   ├── hr-dashboard.tsx             # HR dashboard
│   ├── employees-list.tsx           # Employee list with search/filter
│   ├── employee-profile.tsx         # Employee create/edit form
│   ├── module-team-manager.tsx      # Reusable role manager per module
│   ├── sidebar.tsx                  # Collapsible sidebar (240px)
│   ├── header.tsx                   # Unified header with user menu
│   ├── login-page.tsx               # Login form
│   ├── ClientBranding.tsx           # Per-tenant CSS theming
│   └── ...
│
├── lib/
│   ├── api-client.ts                # Frappe API client (HR + Admin)
│   ├── stock-api.ts                 # Inventory/Stock API client
│   ├── sales-api.ts                 # Sales Rep API client
│   ├── company-api.ts               # Company creation & settings
│   ├── auth.ts                      # Auth API functions
│   ├── auth-context.tsx             # Auth React Context (roles, permissions)
│   ├── client-config.ts             # Multi-tenant config loader
│   ├── i18n.tsx                     # Internationalization (AR/EN)
│   ├── location-utils.ts            # GPS utilities
│   ├── utils.ts                     # Shared utilities
│   ├── accounting-api.ts            # Accounting system API client
│   ├── accounting-logic.ts          # Accounting calculations and logic
│   ├── cashier-api.ts               # Cashier/POS API client
│   ├── cashier-utils.ts             # Cashier shared utilities
│   ├── purchase-api.ts              # Purchase orders API client
│   ├── task-api.ts                  # Tasks API client
│   ├── permissions-api.ts           # Permissions management API
│   ├── wallet-api.ts                # Wallet/balance API client
│   ├── zatca-api.ts                 # ZATCA e-invoicing API client
│   ├── register-store.tsx            # Cashier register state management
│   ├── api.ts                       # Generic API helpers
│   ├── breadcrumbs.ts               # Breadcrumb generation
│   ├── export-csv.ts                # CSV export utility
│   ├── status-config.ts             # Status display configuration
│   ├── use-navigation-guard.ts      # Navigation guard hook
│   └── ...
│
├── hooks/
│   ├── use-company.ts               # Company context hook
│   ├── use-gps-broadcaster.ts       # GPS broadcasting hook
│   ├── use-mobile.tsx               # Mobile detection
│   └── use-toast.ts                 # Toast notifications
│
├── contexts/
│   ├── ClientContext.tsx             # Multi-tenant client context
│   └── SalesRepContext.tsx           # Sales rep context
│
├── config/
│   └── clients.json                 # Tenant branding configuration
│
├── middleware.ts                     # Auth guard + company check
├── vercel.json                      # Vercel routing & rewrites
├── next.config.mjs
└── tailwind.config.ts
```

---

## Authentication & Permissions

### Authentication Flow

1. User logs in via `/login` → Frappe session cookies (`sid`, `user_id`) are set
2. `middleware.ts` checks for valid session cookies on every request
3. `AuthProvider` fetches user info, roles, and company data from Frappe

### Role Hierarchy

Admin role **cascades** into all other roles — an Admin has access to everything:

| Flag | Access Granted When |
|------|-------------------|
| `isAdmin` | `Administrator` OR `System Manager` |
| `isHRUser` | `isAdmin` OR `HR Manager` OR `HR User` |
| `isHRManager` | `isAdmin` OR `HR Manager` |
| `isSalesUser` | `isAdmin` OR `Sales Manager` OR `Sales User` OR `Sales Master Manager` |
| `isSalesRepsUser` | `isAdmin` OR `Sales Manager` OR `Sales User` |

### Module Access Control

Each system module is gated by `moduleAccess`:

| Module | Required Roles |
|--------|---------------|
| `admin` | Admin only |
| `hr` | Admin, HR Manager, HR User |
| `sales` | Admin, Sales Manager, Sales User, Sales Master Manager |
| `salesReps` | Admin, Sales Manager, Sales User |
| `inventory` | Admin, Sales Manager, Sales User, Sales Master Manager, Stock Manager, Stock User |

### Page-Level Protection

| Page | Permission |
|------|-----------|
| `/hr`, `/employees`, `/attendance`, `/payroll`, `/shift-management` | `isHRUser` |
| `/employee/new` | `isHRManager` |
| `/hr-managers` | `isHRManager` |
| `/inventory` | `moduleAccess.inventory` |
| `/admin` | `isAdmin` |

### Auto Role Assignment on Employee Creation

When a new employee is created with a user account, the system automatically assigns:
- **Always**: `Employee` + `HR User` roles
- **Based on designation**:

| Designation contains | Additional role |
|---------------------|----------------|
| HR Manager | `HR Manager` |
| Sales Manager | `Sales Manager` |
| Sales (other) | `Sales User` |
| Stock/Inventory/Warehouse Manager | `Stock Manager` |
| Stock/Inventory/Warehouse/Storekeeper/Procurement/Logistics... | `Stock User` |

Arabic designations are also matched (e.g. مدير مبيعات, أمين مستودع).

---

## Multi-Tenant Configuration

The platform supports multiple tenants (clients) with custom branding. Configuration is in `config/clients.json`:

```json
{
  "qarawi.base.meena.sa": {
    "branding": {
      "appName": "Qarawi HR System",
      "primaryColor": "#3B82F6",
      "logo": "/logo.jpeg",
      "favicon": "/favicon.ico"
    }
  },
  "fayez.base.meena.sa": {
    "branding": {
      "appName": "Fayez HR System",
      "primaryColor": "#10B981"
    }
  },
  "default": {
    "branding": {
      "appName": "Meena HR System",
      "primaryColor": "#3B82F6"
    }
  }
}
```

- **Domain resolution**: exact match → wildcard subdomain → `default` fallback
- **Branding**: `ClientBranding` component injects `--primary-color` CSS variable at runtime
- **Backend URL**: derived from the current domain (same-domain architecture)

---

## Setup Wizard

On first launch (when no Company exists in Frappe), `middleware.ts` redirects to `/setup-wizard`:

1. **Company Info** — Name + auto-generated abbreviation
2. **Location** — Country (default: Saudi Arabia) + Currency (default: SAR)
3. **Confirm** — Review and create

Automatically creates: Company, Fiscal Year, Warehouse Types (6), and default settings.

---

## System Modules

### HR Management

| Feature | Description |
|---------|-------------|
| Employee Management | Add, edit, activate/deactivate employees |
| Attendance | Check-in/out with GPS location tracking |
| Auto Attendance | Automated attendance mark/processing |
| Biometric Integration | Biometric device data sync |
| Branch Management | Organizational branch hierarchy |
| Leave Management | Leave applications and approvals |
| Payroll | Salary slips and payroll processing |
| Shift Management | Create and assign work shifts |
| Location Tracking | Real-time GPS tracking of employees |
| Radius Alerts | Geofence-based attendance alerts |
| HR Settings | Configure leave types, holidays, etc. |
| Employee Reports | Employee data reporting |
| Permission Management | Assign/remove roles via `/hr-managers` |

### Accounting

Double-entry accounting system built on Frappe's accounting backend:

| Section | Route | Description |
|---------|-------|-------------|
| Dashboard | `/accounting` | Key financial metrics and quick access |
| Chart of Accounts | `/accounting/chart-of-accounts` | Hierarchical account tree management |
| General Ledger | `/accounting/general-ledger` | Detailed transaction ledger with filters |
| AR Aging | `/accounting/ar-aging` | Accounts Receivable aging report |
| AP Aging | `/accounting/ap-aging` | Accounts Payable aging report |
| Profit & Loss | `/accounting/pnl` | Income statement |
| Balance Sheet | `/accounting/balance-sheet` | Financial position snapshot |
| Trial Balance | `/accounting/trial-balance` | Trial balance report |
| Cash Flow | `/accounting/cash-flow` | Cash flow statement |
| Journal Entries | `/accounting/journal-entries` | Manual journal entry creation and listing |
| Payment Entries | `/accounting/payment-entries` | Payment entry management |
| Bank Reconciliation | `/accounting/bank-reconciliation` | Bank statement matching |
| Purchase Invoices | `/accounting/purchase-invoices` | Supplier invoice management |
| Sales Invoices | `/accounting/sales-invoices` | Customer invoice management |
| VAT | `/accounting/vat` | VAT return and reporting |
| Period Closing | `/accounting/period-closing` | Month/year end closing procedures |

### Cashier (POS)

Full-featured Point-of-Sale system with offline support:

| Feature | Description |
|---------|-------------|
| Checkout | Product search (with `AbortController`), barcode scan, cart with VAT, multiple payment methods, F-key shortcuts |
| Returns | Full and partial returns with supervisor authorization, printable return receipt |
| Hold/Park | Park current cart, serve another customer, resume later via localStorage |
| Offline Queue | Sales queue to localStorage, auto-sync on reconnection |
| Cart Persistence | Cart survives page refresh via localStorage |
| History | Invoice history with re-print and void (supervisor auth required) |
| Reports | Per-payment-method totals, top items, session reports |
| Settings | Cashier configuration, opening cash, session management (close with per-method breakdown) |

See [Cashier System — Audit Update](#cashier-system--audit-update-v3) for detailed bug fixes, logic optimizations, and feature list.

### Inventory Management

Full inventory system with its own sidebar navigation:

| Section | Description |
|---------|-------------|
| Dashboard | Overview with key metrics |
| Warehouses | CRUD for warehouses (Main, Van, Customer Location, etc.) |
| Products | Item management with UOM conversions, pricing, barcodes |
| Live Inventory | Real-time stock per warehouse (from `Bin` doctype) |
| Transfers | Stock transfer requests between warehouses |
| Returns | Customer product returns |
| Audit Log | Complete stock movement history |
| Reconciliation | Physical vs system stock comparison |

### Purchases

| Feature | Description |
|---------|-------------|
| Purchase Orders | Create and manage purchase orders |
| Supplier Management | Track suppliers and purchase history |
| Purchase Invoices | Manage supplier invoices and payments |

### Tasks

| Feature | Description |
|---------|-------------|
| Task Dashboard | View and manage assigned tasks |
| Task Creation | Create tasks with assignments and due dates |
| Status Tracking | Track task progress and completion |

### Sales Rep Portal

Mobile-first PWA for field sales representatives:

| Feature | Route |
|---------|-------|
| Dashboard | `/sales-rep` |
| New Order | `/sales-rep/new-order` |
| Order History | `/sales-rep/order-history` |
| Payments | `/sales-rep/payments` |
| Route Plan | `/sales-rep/route-plan` |
| Stock Requests | `/sales-rep/stock-requests` |
| Inventory Records | `/sales-rep/inventory-records` |
| Customer Inventory | `/sales-rep/customer-inventory` |
| Invoices | `/sales-rep/invoice` |
| My Map | `/sales-rep/my-map` |

### Admin Panel

System-wide administration:

| Feature | Description |
|---------|-------------|
| Module Team Manager | Add/remove users from module roles |
| System Settings | Configure system-wide parameters |
| User Management | View and manage all users |

---

## Internationalization

Full bilingual support — Arabic (RTL) and English (LTR):

- All UI text, labels, statuses, and error messages are translated
- RTL layout support with `dir="rtl"` switching
- Language toggle in the header
- Translations in `lib/i18n.tsx`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Radix UI / shadcn/ui |
| Icons | Lucide React |
| Maps | Leaflet.js |
| Backend | Frappe 15.x / ERPNext 15.x / HRMS |
| E-Invoicing | ZATCA (Saudi tax authority compliance) |
| Auth | Session cookies (Frappe `sid` + `user_id`) |
| Deployment | Vercel |
| Testing | Jest + Playwright |

---

## API Proxy

All API requests are proxied through `/api/frappe` to avoid CORS issues:

```
Browser → /api/frappe?path=/api/resource/Employee → Frappe Backend
```

The proxy:
- Forwards session cookies for authentication
- Forwards ALL `Set-Cookie` headers back (using `getSetCookie()`)
- Handles file uploads (multipart/form-data)
- Safely parses non-JSON responses (HTML error pages, CSRF errors)
- Supports GET, POST, PUT, DELETE methods

### File Upload

```
Browser → /api/upload_file → Frappe Backend
```

Dedicated file upload endpoint that handles multipart/form-data uploads to Frappe's file system.

---

## Deployment

### Vercel (Recommended)

```bash
vercel --prod
```

Or push to `master` branch for automatic deployment.

**Required Vercel settings:**
- Framework: Next.js
- Build command: `next build`
- Environment variables: see [Environment Variables](#environment-variables)

### Self-Hosted

```bash
npm run build
npm start
```

The app runs on port 3000 by default.

---

## Testing

```bash
# Unit tests (Jest)
npm test                    # Watch mode
npm run test:unit           # Single run
npm run test:ci             # CI mode with coverage
npm run test:coverage       # Coverage report

# Integration tests
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e
npm run test:e2e:ui         # Interactive mode
npm run test:e2e:debug      # Debug mode
```

---

## Backend Apps

The Frappe bench includes these custom apps (repo: `potato707/base-meena`):

| App | Description |
|-----|-------------|
| `base_meena` | Core — stock management, financial management, product management, sales management |
| `hr_custom` | HR customizations |
| `hrms` | Frappe HRMS (attendance, leaves, payroll, shifts) |
| `erpnext` | ERPNext core (customized) |
| `site_creator` | Multi-tenant site provisioning |
| `site_guard` | Site security & access control |
| `domain_manager` | Domain management for tenants |
| `tenant_manager` | Tenant lifecycle management |

---

## Cashier System — Audit Update (v3)

This section documents all fixes and new features from the comprehensive cashier system audit.

### Fixed Bugs

| ID | Severity | Description |
|---|---|---|
| **B1** | Critical | F10 keyboard shortcut sent empty payments due to stale closure — now uses `useRef` for latest handler |
| **B2** | High | Close session pre-filled closing cash with 0 (`useState` timing bug) — now uses `useEffect` after session loads |
| **B3** | High | Cart-level global discount was dead code — added `SET_CART_DISCOUNT` action, UI toggle, and backend submission |
| **B4** | High | Product grid reloaded on every cart action — fixed with `useRef` for callback and stable dependencies |
| **B5** | Low | Removed unused `Download` import in receipt preview |
| **B6** | Low | Removed unused `printRef` ref in receipt preview |
| **B7** | High | F4/F8/F9/F10 keyboard shortcuts fired while user was typing in inputs — now checks `isInput` flag |
| **B8** | Medium | Returns page had no guard against missing/expired session — added session guard |

### Logic Optimizations

| ID | Description |
|---|---|
| **L1** | Added `AbortController` to product search — cancels in-flight requests to prevent race conditions |
| **L2** | `refreshSession` fetches session and settings independently — one failure no longer masks the other |
| **L3** | Barcode scan no longer fires a duplicate debounced search |
| **L4** | Replaced `useReducer` misuse (identity reducer) with proper `useState` |
| **L5** | `completeSale` atomically clears the cart inside the context on success |
| **L6** | Server time offset calculation documented for network latency awareness |
| **L7** | `PaymentPanel.activeMode` reactively updates when settings load asynchronously |
| **L8** | `PaymentPanel.useEffect` no longer suppresses deps — numpad pre-fill uses current values |

### New Features

| ID | Feature | Description |
|---|---|---|
| **G1** | Partial Returns | Select specific items and quantities to return instead of full-invoice only |
| **G2** | Tax in Cart | Cart displays VAT (15%) as a separate line before the total |
| **G3** | Supervisor Auth | Returns, voids, and sensitive ops require supervisor credentials |
| **G4** | Offline Queue | Sales queue to localStorage when offline, auto-sync on reconnection |
| **G5** | Cart Persistence | Cart survives page refresh via localStorage |
| **G6** | Direct Qty Entry | Click the quantity number to type a value directly |
| **G7** | Void Invoice | "Void Invoice" button on receipt for immediate cancellation (requires supervisor auth) |
| **G8** | Receipt Re-print | Click any invoice in history to view and re-print its receipt |
| **G9** | Dynamic VAT Label | Receipt computes VAT % from actual amounts instead of hardcoding "15%" |
| **G10** | Dynamic Currency | All formatting uses settings currency instead of hardcoded "SAR" |
| **G11** | QuickAddItem Restriction | Only managers/admins can create items from POS |
| **G12** | Hold/Park Transactions | Hold current cart, serve another customer, resume later |
| **G13** | Payment Breakdown | Reports show per-payment-method totals and top items |
| **G14** | Return Receipt | Returns display a printable receipt with "RETURN/REFUND" banner |

### Data Integrity Fixes

| ID | Description |
|---|---|
| **D1** | Cart `grandTotal` includes VAT so payment amount matches backend invoice |
| **D4** | Session closing sends per-payment-method amounts for multi-method reconciliation |
| **D5** | Opening cash validates non-negative at both HTML and JavaScript levels |
| **D6** | Receipt payments use backend invoice data (with client fallback) |
| **D7** | `searchCustomers` routes through custom cashier API instead of raw Frappe |
| **D8** | Duplicate submission prevention via `submittingRef` |

### New Files

| File | Purpose |
|---|---|
| `lib/cashier-utils.ts` | Shared utilities: currency formatting, validation, cart persistence, offline queue, hold transactions |
| `components/cashier/supervisor-auth.tsx` | Reusable supervisor authorization dialog |
| `components/cashier/hold-transactions.tsx` | Hold/park and resume transaction management |

---

## License

Private — All rights reserved.

---

# دليل هيكلية مشروع Frappe Bench

## نظرة عامة على المشروع

هذا المشروع عبارة عن تثبيت Frappe Bench يحتوي على أربعة تطبيقات رئيسية:
- **Frappe Framework** - الإطار الأساسي
- **ERPNext** - نظام تخطيط موارد المؤسسة
- **HRMS** - نظام إدارة الموارد البشرية
- **Base Meena** - تطبيق مخصص لإعادة تصميم واجهة المستخدم

---

## هيكلية المشروع العامة

```
frappe-bench/
├── apps/                    # مجلد التطبيقات
│   ├── frappe/             # الإطار الأساسي
│   ├── erpnext/            # نظام ERP
│   ├── hrms/               # نظام الموارد البشرية
│   └── base_meena/         # تطبيق التخصيص
├── config/                 # ملفات التكوين
│   ├── redis_cache.conf   # تكوين Redis للتخزين المؤقت
│   ├── redis_queue.conf   # تكوين Redis لقوائم الانتظار
│   └── scheduler_process  # تكوين المجدول
├── sites/                  # مجلد المواقع
│   ├── apps.json          # قائمة التطبيقات المثبتة
│   ├── apps.txt           # ملف نصي للتطبيقات
│   └── assets/            # الملفات الثابتة المترجمة
├── .gitignore             # ملف Git تجاهل
├── Procfile               # ملف تكوين العمليات
└── patches.txt            # ملف التصحيحات
```

---

# التطبيقات بالتفصيل

## 1. Frappe Framework (الإطار الأساسي)

### الوصف
Frappe هو إطار عمل مفتوح المصدر مكتوب بلغة Python و JavaScript، يوفر البنية التحتية الأساسية لبناء تطبيقات الويب وأنظمة إدارة الأعمال.

### هيكلية التطبيق

```
apps/frappe/
├── frappe/                      # الكود الأساسي
│   ├── __init__.py             # ملف التهيئة
│   ├── app.py                  # إدارة التطبيقات
│   ├── auth.py                 # نظام المصادقة
│   ├── boot.py                 # عملية الإقلاع
│   ├── cache_manager.py        # إدارة التخزين المؤقت
│   ├── client.py               # إدارة العميل
│   ├── database/               # قاعدة البيانات
│   ├── model/                  # النماذج البيانية
│   ├── query_builder/          # بناء الاستعلامات
│   ├── utils/                  # الأدوات المساعدة
│   ├── workflow/               # سير العمل
│   ├── email/                  # نظام البريد الإلكتروني
│   ├── printing/               # الطباعة
│   ├── website/                # الموقع الإلكتروني
│   ├── desk/                   # واجهة الإدارة
│   ├── social/                 # التواصل الاجتماعي
│   ├── geo/                    # الموقع الجغرافي
│   ├── contacts/               # جهات الاتصال
│   ├── integrations/           # التكاملات
│   ├── automation/             # الأتمتة
│   ├── custom/                 # التخصيص
│   ├── locale/                 # اللغات
│   ├── search/                 # البحث
│   ├── pulse/                  # المراقبة
│   ├── realtime/               # الاتصال الفوري
│   ├── types/                  # أنواع البيانات
│   ├── translations/           # الترجمات
│   ├── templates/              # القوالب
│   ├── tests/                  # الاختبارات
│   └── public/                 # الملفات العامة
├── realtime/                    # ملفات الاتصال الفوري
├── esbuild/                     # أدوات البناء
├── cypress/                     # اختبارات Cypress
├── .github/                     # تكوينات GitHub
├── package.json                 # تبعيات Node.js
├── pyproject.toml              # تبعيات Python
└── README.md                   # ملف القراءة
```

### الوحدات الأساسية (Modules)

| الوحدة | الوصف |
|--------|-------|
| **Core** | الوحدات الأساسية (User, Role, DocType, إلخ) |
| **Website** | إدارة الموقع الإلكتروني والصفحات |
| **Workflow** | نظام سير العمل والموافقات |
| **Email** | إدارة البريد الإلكتروني |
| **Custom** | التخصيصات والبرامج النصية |
| **Geo** | الموقع الجغرافي والخرائط |
| **Desk** | واجهة الإدارة |
| **Integrations** | التكاملات مع خدمات خارجية |
| **Printing** | تنسيقات الطباعة |
| **Contacts** | إدارة جهات الاتصال |
| **Social** | التواصل الاجتماعي |
| **Automation** | الأتمتة والجدولة |

### أنواع DocTypes الأساسية

| DocType | الوصف |
|---------|-------|
| **User** | إدارة المستخدمين |
| **Role** | إدارة الصلاحيات |
| **DocType** | تعريف أنواع المستندات |
| **DocField** | حقول المستندات |
| **DocPerm** | صلاحيات المستندات |
| **DocShare** | مشاركة المستندات |
| **File** | إدارة الملفات |
| **Comment** | التعليقات |
| **Communication** | الاتصالات |
| **System Settings** | إعدادات النظام |
| **Navbar Settings** | إعدادات شريط التنقل |
| **Module Def** | تعريف الوحدات |
| **Domain** | المجالات |
| **Language** | اللغات |
| **Translation** | الترجمات |
| **Version** | إدارة الإصدارات |
| **Error Log** | سجل الأخطاء |
| **Access Log** | سجل الدخول |
| **Activity Log** | سجل النشاط |
| **Audit Trail** | تدقيق التغييرات |
| **Scheduled Job Type** | أنواع المهام المجدولة |
| **Server Script** | البرامج النصية للخادم |
| **Report** | التقارير |
| **Page** | الصفحات المخصصة |
| **Web Form** | نماذج الويب |
| **Workspace** | مساحات العمل |

---

## 2. ERPNext (نظام تخطيط موارد المؤسسة)

### الوصف
ERPNext هو نظام ERP مفتوح المصدر مبني على Frappe Framework، يوفر حلاً متكاملاً لإدارة جميع جوانب الأعمال.

### هيكلية التطبيق

```
apps/erpnext/
├── erpnext/                     # الكود الأساسي
│   ├── __init__.py            # ملف التهيئة
│   ├── hooks.py               # الخطافات
│   ├── accounts/              # المحاسبة
│   ├── crm/                   # إدارة علاقات العملاء
│   ├── buying/                # المشتريات
│   ├── selling/               # المبيعات
│   ├── stock/                 # المخزون
│   ├── manufacturing/         # التصنيع
│   ├── projects/              # المشاريع
│   ├── support/               # خدمة العملاء
│   ├── assets/                # إدارة الأصول
│   ├── maintenance/           # الصيانة
│   ├── quality_management/    # إدارة الجودة
│   ├── utilities/             # الأدوات المساعدة
│   ├── portal/                # البوابة
│   ├── setup/                 # الإعداد
│   ├── regional/              # الإعدادات الإقليمية
│   ├── erpnext_integrations/ # تكاملات ERPNext
│   ├── communication/         # الاتصالات
│   ├── telephony/             # الهاتف
│   ├── bulk_transaction/      # المعاملات الجماعية
│   ├── subcontracting/       # التعاقد من الباطن
│   ├── edi/                   # تبادل البيانات الإلكتروني
│   ├── shopping_cart/         # سلة التسوق
│   ├── startup/               # البداية
│   ├── domains/               # المجالات
│   ├── controllers/           # المتحكمات
│   ├── config/                # التكوين
│   ├── patches/               # التصحيحات
│   ├── templates/             # القوالب
│   ├── tests/                 # الاختبارات
│   ├── translations/          # الترجمات
│   ├── public/                # الملفات العامة
│   └── www/                   # موقع الويب
├── .github/                    # تكوينات GitHub
├── package.json                # تبعيات Node.js
├── pyproject.toml             # تبعيات Python
└── README.md                   # ملف القراءة
```

### الوحدات الأساسية (Modules)

| الوحدة | الوصف |
|--------|-------|
| **Accounts** | المحاسبة المالية |
| **CRM** | إدارة علاقات العملاء |
| **Buying** | إدارة المشتريات |
| **Selling** | إدارة المبيعات |
| **Stock** | إدارة المخزون |
| **Manufacturing** | التصنيع والإنتاج |
| **Projects** | إدارة المشاريع |
| **Support** | خدمة العملاء |
| **Assets** | إدارة الأصول الثابتة |
| **Maintenance** | إدارة الصيانة |
| **Quality Management** | إدارة الجودة |
| **Utilities** | الأدوات المساعدة |
| **Portal** | البوابة الإلكترونية |
| **Setup** | إعداد النظام |
| **Regional** | الإعدادات الإقليمية |
| **ERPNext Integrations** | تكاملات خارجية |
| **Communication** | إدارة الاتصالات |
| **Telephony** | إدارة الهاتف |
| **Bulk Transaction** | المعاملات الجماعية |
| **Subcontracting** | التعاقد من الباطن |
| **EDI** | تبادل البيانات الإلكتروني |

### مكونات الوحدات

كل وحدة في ERPNext تحتوي على:

| المكون | الوصف |
|--------|-------|
| **doctype/** | أنواع المستندات الخاصة بالوحدة |
| **page/** | صفحات مخصصة |
| **report/** | التقارير |
| **print_format/** | تنسيقات الطباعة |
| **dashboard_chart/** | رسوم بيانية للوحة التحكم |
| **dashboard_chart_source/** | مصادر البيانات للرسوم البيانية |
| **workspace/** | مساحات العمل |
| **notification/** | الإشعارات |
| **number_card/** | بطاقات الأرقام |
| **form_tour/** | جولات الإرشاد |
| **module_onboarding/** | إعداد الوحدة |
| **onboarding_step/** | خطوات الإعداد |
| **test/** | الاختبارات |
| **custom/** | التخصيصات |

---

## 3. HRMS (نظام إدارة الموارد البشرية)

### الوصف
HRMS هو تطبيق متكامل لإدارة الموارد البشرية و الرواتب، مبني على Frappe Framework.

### هيكلية التطبيق

```
apps/hrms/
├── hrms/                        # الكود الأساسي
│   ├── __init__.py             # ملف التهيئة
│   ├── hooks.py                # الخطافات
│   ├── hr/                     # إدارة الموارد البشرية
│   ├── payroll/                # الرواتب
│   ├── api/                    # واجهة برمجة التطبيقات
│   ├── config/                 # التكوين
│   ├── controllers/            # المتحكمات
│   ├── locale/                 # اللغات
│   ├── mixins/                 # Mixins
│   ├── overrides/             | # التجاوزات
│   ├── patches/                # التصحيحات
│   ├── utils/                  # الأدوات المساعدة
│   ├── templates/              # القوالب
│   ├── tests/                  # الاختبارات
│   ├── translations/           # الترجمات
│   ├── public/                 # الملفات العامة
│   ├── desktop_icon/           # أيقونات سطح المكتب
│   ├── workspace_sidebar/      # الشريط الجانبي
│   └── www/                    # موقع الويب
├── frontend/                    # الواجهة الأمامية
│   ├── index.html             # الصفحة الرئيسية
│   ├── sw.js                   # Service Worker
│   ├── manifest.webmanifest    # Manifest
│   └── assets/                 # الملفات الثابتة
├── roster/                      # إدارة المناوبات
├── docker/                      # تكوين Docker
├── .github/                     # تكوينات GitHub
├── package.json                 # تبعيات Node.js
├── pyproject.toml              # تبعيات Python
└── README.md                   # ملف القراءة
```

### الوحدات الأساسية (Modules)

| الوحدة | الوصف |
|--------|-------|
| **HR** | إدارة الموارد البشرية |
| **Payroll** | إدارة الرواتب |

### مكونات وحدة HR

| المكون | الوصف |
|--------|-------|
| **doctype/** | أنواع المستندات (Employee, Leave, Attendance, إلخ) |
| **page/** | صفحات مخصصة |
| **report/** | التقارير |
| **print_format/** | تنسيقات الطباعة |
| **web_form/** | نماذج الويب |
| **dashboard_chart/** | رسوم بيانية |
| **dashboard_chart_source/** | مصادر البيانات |
| **workspace/** | مساحات العمل |
| **notification/** | الإشعارات |
| **number_card/** | بطاقات الأرقام |
| **hr_dashboard/** | لوحة تحكم الموارد البشرية |

### مكونات وحدة Payroll

| المكون | الوصف |
|--------|-------|
| **doctype/** | أنواع المستندات (Salary Slip, Payroll Entry, إلخ) |
| **report/** | التقارير |
| **print_format/** | تنسيقات الطباعة |
| **dashboard_chart/** | رسوم بيانية |
| **dashboard_chart_source/** | مصادر البيانات |
| **workspace/** | مساحات العمل |
| **notification/** | الإشعارات |
| **number_card/** | بطاقات الأرقام |
| **payroll_dashboard/** | لوحة تحكم الرواتب |
| **data/** | البيانات المرجعية |

---

## 4. Base Meena (تطبيق التخصيص)

### الوصف
تطبيق مخصص لإعادة تصميم واجهة Frappe Framework بالكامل بشكل عصري واحترافي، مع إضافة شريط تنقل سفلي (Meena Dock) يحتوي على روابط سريعة لجميع الوحدات.

### هيكلية التطبيق

```
apps/base_meena/
├── base_meena/                  # الكود الأساسي
│   ├── __init__.py            # ملف التهيئة
│   ├── api.py                  # واجهة برمجة التطبيقات
│   ├── hooks.py                # الخطافات
│   ├── modules.txt             # قائمة الوحدات
│   ├── patches.txt             # التصحيحات
│   ├── base_meena/             # الوحدة الرئيسية
│   │   ├── __init__.py        # ملف التهيئة
│   │   ├── api.py             # واجهة برمجة التطبيقات
│   │   ├── doctype/           # أنواع المستندات
│   │   │   ├── meena_dock_menu_item/    # عنصر قائمة الدوك
│   │   │   ├── meena_dock_module/       # موديول الدوك
│   │   │   └── meena_dock_settings/     # إعدادات الدوك
│   │   ├── page/              # الصفحات
│   │   │   ├── dock_config/   # صفحة تكوين الدوك
│   │   │   └── dock_settings/ # صفحة إعدادات الدوك
│   │   └── translations/      # الترجمات
│   ├── config/                 # التكوين
│   ├── doctype/                # أنواع المستندات
│   ├── fixtures/               # البيانات الثابتة
│   ├── public/                 # الملفات العامة
│   │   ├── css/                # ملفات CSS
│   │   ├── js/                 # ملفات JavaScript
│   │   └── images/             # الصور
│   ├── templates/              # القوالب
│   └── translations/           # الترجمات
├── .github/                     # تكوينات GitHub
├── README.md                    # ملف القراءة
├── DEVELOPMENT.md              # دليل التطوير
├── USER_GUIDE.md               # دليل المستخدم
├── TECHNICAL.md                # الدليل التقني
├── ROADMAP.md                  # خارطة الطريق
├── QUICK_REFERENCE.md          # مرجع سريع
├── CARDS_VIEW_README.md        # دليل عرض البطاقات
├── CHANGELOG.md                # سجل التغييرات
├── pyproject.toml              # تبعيات Python
└── package.json                # تبعيات Node.js
```

### الوحدات الأساسية (Modules)

| الوحدة | الوصف |
|--------|-------|
| **Base Meena** | الوحدة الرئيسية للتخصيص |

### DocTypes المخصصة

| DocType | الوصف |
|---------|-------|
| **Meena Dock Module** | تعريف موديولات الدوك (12 موديول) |
| **Meena Dock Menu Item** | عناصر القائمة لكل موديول |
| **Meena Dock Settings** | إعدادات شريط الدوك |

### الصفحات المخصصة

| الصفحة | الوصف |
|--------|-------|
| **Dock Config** | صفحة تكوين شريط الدوك |
| **Dock Settings** | صفحة إعدادات شريط الدوك |

### ملفات CSS العامة

| الملف | الوصف |
|-------|-------|
| **meena_dock.css** | تنسيقات شريط الدوك الرئيسي |
| **mobile_dock.css** | تنسيقات شريط الدوك للموبايل |
| **force_rtl.css** | فرض الاتجاه من اليمين لليسار |
| **universal_dashboard.css** | تنسيقات لوحة التحكم الشاملة |
| **hr_dashboard_view.css** | تنسيقات لوحة تحكم الموارد البشرية |
| **project_dashboard.css** | تنسيقات لوحة تحكم المشاريع |
| **buying_dashboard.css** | تنسيقات لوحة تحكم المشتريات |
| **manufacturing_dashboard.css** | تنسيقات لوحة تحكم التصنيع |
| **stock_dashboard.css** | تنسيقات لوحة تحكم المخزون |
| **cards_view.css** | تنسيقات عرض البطاقات |
| **employee_cards.css** | تنسيقات بطاقات الموظفين |
| **recruitment_view.css** | تنسيقات عرض التوظيف |
| **small_square.css** | تنسيقات المربعات الصغيرة |
| **timesheet_quick_entry.css** | تنسيقات الإدخال السريع لجداول الأوقات |

### ملفات JavaScript العامة

| الملف | الوصف |
|-------|-------|
| **meena_dock.js** | شريط الدوك الرئيسي |
| **mobile_dock.js** | شريط الدوك للموبايل |
| **meena_dock_bottom.js** | شريط الدوك السفلي |
| **dock_customizer.js** | أداة تخصيص الدوك |
| **meena_dashboard_manager.js** | مدير لوحات التحكم |
| **universal_dashboard.js** | لوحة التحكم الشاملة |
| **hr_dashboard_view.js** | عرض لوحة تحكم الموارد البشرية |
| **project_dashboard.js** | لوحة تحكم المشاريع |
| **buying_dashboard.js** | لوحة تحكم المشتريات |
| **manufacturing_dashboard.js** | لوحة تحكم التصنيع |
| **stock_dashboard.js** | لوحة تحكم المخزون |
| **cards_view.js** | عرض البطاقات |
| **employee_cards.js** | بطاقات الموظفين |
| **recruitment_view.js** | عرض التوظيف |
| **small_square.js** | المربعات الصغيرة |
| **timesheet_quick_entry.js** | الإدخال السريع لجداول الأوقات |
| **frappe_dashboard_integration.js** | تكامل مع لوحات تحكم Frappe |

### الموديولات الـ 12 في Meena Dock

| الموديول | اللون | الوصف |
|----------|-------|-------|
| **إدارة الموارد البشرية (HR)** | 🔵 أزرق | إدارة الموظفين والرواتب |
| **المبيعات (Sales)** | 🟢 أخضر | إدارة المبيعات والعملاء |
| **المشتريات (Purchasing)** | 🟠 برتقالي | إدارة المشتريات والموردين |
| **المخزون (Inventory)** | 🟡 أصفر | إدارة المخزون والمستودعات |
| **المحاسبة (Accounting)** | 🟣 بنفسجي | الحسابات المالية والتقارير |
| **التصنيع (Manufacturing)** | 🔴 أحمر | إدارة التصنيع والإنتاج |
| **المشاريع (Projects)** | 🩵 سماوي | إدارة المشاريع والمهام |
| **خدمة العملاء (Support)** | 🩷 وردي | خدمة العملاء والتذاكر |
| **الموقع الإلكتروني (Website)** | 🔷 أزرق داكن | إدارة الموقع الإلكتروني |
| **الجودة (Quality)** | 🔵 أزرق فاتح | إدارة الجودة والفحص |
| **الأصول (Assets)** | ⚫ أسود | إدارة الأصول الثابتة |
| **نقاط البيع (POS)** | 🔴 أحمر فاتح | نظام نقاط البيع |

### الترجمات المدعومة

يدعم التطبيق أكثر من 60 لغة، بما في ذلك:
- العربية (ar)
- الإنجليزية (en)
- الفرنسية (fr)
- الألمانية (de)
- الإسبانية (es)
- الإيطالية (it)
- التركية (tr)
- الفارسية (fa)
- الأردية (ur)
- والكثير من اللغات الأخرى...

---

## مجلد المواقع (Sites)

### هيكلية المجلد

```
sites/
├── apps.json              # قائمة التطبيقات المثبتة بصيغة JSON
├── apps.txt               # قائمة التطبيقات المثبتة بصيغة نصية
├── assets/                # الملفات الثابتة المترجمة
│   ├── assets.json        # قائمة الملفات الثابتة
│   ├── erpnext/          # ملفات ERPNext
│   │   ├── images/       # الصور
│   │   ├── js/           # ملفات JavaScript
│   │   └── css/          # ملفات CSS
│   ├── frappe/           # ملفات Frappe
│   │   ├── icons/        # الأيقونات
│   │   ├── js/           # ملفات JavaScript
│   │   └── css/          # ملفات CSS
│   ├── hrms/             # ملفات HRMS
│   │   ├── images/       # الصور
│   │   ├── js/           # ملفات JavaScript
│   │   ├── css/          # ملفات CSS
│   │   ├── manifest/     # ملفات Manifest
│   │   └── locale/       # ملفات اللغات
│   └── base_meena/       # ملفات Base Meena
│       ├── css/          # ملفات CSS
│       └── js/           # ملفات JavaScript
└── locale/               # ملفات الترجمة
    ├── ar/              # العربية
    │   └── LC_MESSAGES/
    │       ├── frappe.mo
    │       └── hrms.mo
    └── [لغات أخرى]...  # لغات أخرى
```

---

## مجلد التكوين (Config)

### الملفات

| الملف | الوصف |
|-------|-------|
| **redis_cache.conf** | تكوين Redis للتخزين المؤقت |
| **redis_cache.acl** | قوائم التحكم في الوصول للتخزين المؤقت |
| **redis_queue.conf** | تكوين Redis لقوائم الانتظار |
| **redis_queue.acl** | قوائم التحكم في الوصول لقوائم الانتظار |
| **scheduler_process** | تكوين عملية المجدول |
| **pids/** | مجلد معرفات العمليات |

---

## الملفات الرئيسية في الجذر

| الملف | الوصف |
|-------|-------|
| **.gitignore** | ملف Git تجاهل الملفات |
| **Procfile** | ملف تكوين العمليات للنشر |
| **patches.txt** | ملف التصحيحات |

---

## تقنيات وأدوات المشروع

### Backend
- **Python** - لغة البرمجة الرئيسية
- **Frappe Framework** - الإطار الأساسي
- **MariaDB/MySQL** - قاعدة البيانات
- **Redis** - التخزين المؤقت وقوائم الانتظار

### Frontend
- **JavaScript** - لغة البرمجة الرئيسية
- **Vue.js** - إطار العمل (في بعض الأجزاء)
- **Bootstrap** - إطار التصميم
- **Chart.js** - الرسوم البيانية

### أدوات التطوير
- **Bench** - أداة إدارة Frappe
- **Git** - نظام التحكم في الإصدارات
- **Pre-commit** - فحص الكود قبل الإرسال
- **ESLint** - فحص JavaScript
- **Prettier** - تنسيق الكود
- **Ruff** - فحص Python
- **Pyupgrade** - تحديث Python

---

## البنية المعمارية

### طبقات النظام

```
┌─────────────────────────────────────┐
│         واجهة المستخدم (UI)         │
│  (Meena Dock + Frappe Desk)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      طبقة التطبيقات (Apps)          │
│  (ERPNext + HRMS + Base Meena)      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      إطار العمل (Framework)         │
│         (Frappe)                    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      قاعدة البيانات (Database)      │
│      (MariaDB/MySQL)                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      التخزين المؤقت (Cache)         │
│         (Redis)                     │
└─────────────────────────────────────┘
```

---

## المفاهيم الأساسية في Frappe

### DocType
- **التعريف:** DocType هو تعريف لنوع مستند في النظام
- **المثال:** Customer, Invoice, Employee
- **المكونات:** الحقول (Fields)، الصلاحيات (Permissions)، الأحداث (Events)

### Module
- **التعريف:** Module هو مجموعة من DocTypes ذات صلة
- **المثال:** Accounts, HR, Stock
- **الاستخدام:** تنظيم الوظائف ذات الصلة معاً

### Workspace
- **التعريف:** Workspace هو لوحة تحكم مخصصة لوحدة معينة
- **المثال:** Accounts Workspace, HR Workspace
- **المكونات:** الاختصارات، التقارير، الرسوم البيانية

### Page
- **التعريف:** Page هي صفحة مخصصة في النظام
- **المثال:** Desk, Website
- **الاستخدام:** إنشاء صفحات مخصصة

### Report
- **التعريف:** Report هو تقرير مخصص
- **المثال:** General Ledger, Profit and Loss
- **الاستخدام:** عرض البيانات بشكل منظم

### Hook
- **التعريف:** Hook هو نقطة تخصيص في النظام
- **المثال:** app_hooks.py
- **الاستخدام:** تخصيص سلوك النظام

---

## التثبيت والإعداد

### المتطلبات
- Python 3.8+
- Node.js 16+
- MariaDB 10.6+
- Redis 6+

### التثبيت
```bash
# إنشاء bench جديد
bench init my-bench

# الدخول إلى مجلد bench
cd my-bench

# تثبيت التطبيقات
bench get-app erpnext
bench get-app hrms
bench get-app base_meena

# تثبيت التطبيقات على الموقع
bench install-app erpnext
bench install-app hrms
bench install-app base_meena

# إنشاء موقع جديد
bench new-site mysite.local

# بدء الخادم
bench start
```

---

## الأوامر الأساسية

### أوامر Bench
```bash
# بدء الخادم
bench start

# إيقاف الخادم
bench stop

# إعادة تشغيل الخادم
bench restart

# تحديث التطبيقات
bench update

# ترقية التطبيقات
bench upgrade

# تشغيل الترحيلات
bench migrate

# بناء الملفات الثابتة
bench build

# تثبيت تطبيق
bench get-app <app-name>
bench install-app <app-name>

# إنشاء موقع جديد
bench new-site <site-name>

# استخدام موقع
bench use <site-name>

# تنفيذ أمر
bench execute <command>
```

---

## الدعم والمساعدة

### الروابط المفيدة
- [Frappe Documentation](https://frappeframework.com/docs)
- [ERPNext Documentation](https://docs.erpnext.com)
- [HRMS Documentation](https://docs.frappe.io/hrms)
- [Frappe Forum](https://discuss.frappe.io)

---

## الترخيص

- **Frappe Framework:** MIT License
- **ERPNext:** GNU General Public License v3.0
- **HRMS:** GNU General Public License v3.0
- **Base Meena:** MIT License

---

## المطورون

هذا المشروع مبني على:
- **Frappe Technologies Pvt Ltd** - مطور Frappe Framework و ERPNext
- **Frappe HRMS** - مطور HRMS
- **Base Meena** - تطبيق مخصص للتخصيص

---

## التاريخ

- **2024** - بدء المشروع
- **2025** - إضافة تطبيق Base Meena
- **2026** - التطوير المستمر

---

## خاتمة

هذا المشروع يوفر نظاماً متكاملاً لإدارة الأعمال يجمع بين:
- قوة Frappe Framework
- شمولية ERPNext
- كفاءة HRMS
- جمالية Base Meena

يمكن للمستخدمين الاستفادة من جميع هذه المكونات لإدارة أعمالهم بكفاءة عالية.
