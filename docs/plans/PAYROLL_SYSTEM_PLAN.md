# Payroll System — Implementation Plan

> **Methodology**: Backend → Verify Data → Frontend (React) → Test → Next Feature  
> **Backend Apps**: `hrms` (standard HRMS), `hr_custom` (custom doctypes)  
> **Frontend**: Next.js + shadcn/ui (this workspace)  
> **API**: Frappe REST API (`/api/resource/`, `/api/method/`)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Salary   │ │ Salary    │ │ Salary   │ │ Payroll      │   │
│  │Components│ │Structures │ │  Slips   │ │  Entry       │   │
│  └──────────┘ └───────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Additional│ │ Employee  │ │ Expense  │ │ Compliance   │   │
│  │ Salary   │ │  Loans    │ │ Claims   │ │  Policy      │   │
│  └──────────┘ └───────────┘ └──────────┘ └──────────────┘   │
│               ┌───────────┐ ┌──────────────┐                │
│               │  SSA      │ │ Reports &    │                │
│               │ (assign)  │ │  Analytics   │                │
│               └───────────┘ └──────────────┘                │
└─────────────────────┬────────────────────────────────────────┘
                      │ Frappe REST API
┌─────────────────────┴────────────────────────────────────────┐
│                   Backend (Frappe/ERPNext)                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ HRMS App (apps/hrms) — 43+ payroll doctypes             │ │
│  │  • Salary Component, Salary Structure, SSA              │ │
│  │  • Salary Slip (full calculation engine)                │ │
│  │  • Payroll Entry (bulk processing wizard)               │ │
│  │  • Additional Salary, Expense Claim                     │ │
│  │  • Journal Entry (auto), Bank Advice (report)           │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ hr_custom App (apps/hr_custom) — Custom doctypes        │ │
│  │  • Employee Loan  ← NEEDS CREATION (lending not installed) │
│  │  • Employee Loan Repayment Schedule (child table)       │ │
│  │  • Payroll Compliance Policy (per-country tax/insurance)│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Setup (Foundation)

### 1.1 Salary Components
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists in HRMS (`Salary Component`) |
| **Fields** | name, type (Earning/Deduction), description, depends_on_payment_days, is_tax_applicable, formula, amount, condition |
| **API Endpoints** | `GET/POST/PUT/DELETE /api/resource/Salary Component` |
| **Frontend** | ✅ **COMPLETE** — CRUD table with filters (type, status) |
| **Tests** | ✅ **COMPLETE** — Unit tests with vitest |

**Frontend Deliverables:**
- ✅ `components/payroll/salary-components.tsx` — DataTable with inline editing
- ✅ `lib/api-client.ts` — `getSalaryComponents()`, `createSalaryComponent()`, `updateSalaryComponent()`, `deleteSalaryComponent()`
- ✅ i18n keys: `pay.comp.*` (EN + AR)
- ✅ `components/payroll/__tests__/salary-components.test.tsx` — Unit tests

---

### 1.2 Salary Structures
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists in HRMS (`Salary Structure`) |
| **Child Table** | `Salary Detail` (list of earnings + deductions with formulas) |
| **Fields** | name, company, payroll_frequency, currency, is_active, salary_slip_based_on_timesheet |
| **API Endpoints** | `GET/POST/PUT/DELETE /api/resource/Salary Structure` |
| **Frontend** | ✅ **COMPLETE** — List + create dialog (detail view Phase 2) |
| **Tests** | ✅ **COMPLETE** — Unit tests with vitest |

**Frontend Deliverables:**
- ✅ `components/payroll/salary-structures.tsx` — List view + create dialog
- ⬜ `components/payroll/salary-structure-detail.tsx` — Full editor with child table (Phase 2)
- ✅ API methods in `lib/api-client.ts`
- ✅ i18n keys: `pay.struct.*` (EN + AR)
- ✅ `components/payroll/__tests__/salary-structures.test.tsx` — Unit tests

---

### 1.3 Salary Structure Assignment (SSA)
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists in HRMS (`Salary Structure Assignment`) |
| **Fields** | employee, salary_structure, from_date, base, variable, company |
| **Important** | Links employee → structure; determines which structure is used for slip generation |
| **API Endpoints** | `GET/POST/PUT/DELETE /api/resource/Salary Structure Assignment` |
| **Frontend** | ✅ **COMPLETE** — Assign structures to employees (bulk + individual) |
| **Tests** | ✅ **COMPLETE** — Unit tests with vitest |

**Frontend Deliverables:**
- ✅ `components/payroll/salary-structure-assignment.tsx` — Bulk assignment wizard + list with stats cards
- ✅ API methods in `lib/api-client.ts` (5 endpoints)
- ✅ i18n keys: `pay.ssa.*` (EN + AR)
- ✅ `components/payroll/__tests__/salary-structure-assignment.test.tsx` — Unit tests

---

## Phase 2: Monthly Inputs

### 2.1 Attendance & LWP (Leave Without Pay)
| Item | Status |
|------|--------|
| **Backend** | ✅ Exists — Attendance DocType + Leave Application + `calculate_lwp()` in salary_slip.py |
| **How it works** | Salary Slip auto-pulls attendance data via `get_working_days_details()`. LWP days are deducted from payment_days |
| **Frontend** | ✅ **COMPLETE** — Attendance summary widget with Present/Absent/LWP + month summary |
| **Tests** | ✅ **COMPLETE** — Jest unit test |

**Note:** No new backend needed. The Salary Slip engine already handles LWP calculation automatically.

**Frontend Deliverables:**
- ✅ `components/payroll/attendance-lwp-widget.tsx`
- ✅ Integrated in `app/payroll/page.tsx` as tab
- ✅ `components/payroll/__tests__/attendance-lwp-widget.test.tsx`

---

### 2.2 Additional Salary
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists in HRMS (`Additional Salary`) |
| **Fields** | employee, salary_component, amount, payroll_date, type (Earning/Deduction), overwrite_salary_structure_amount |
| **How it works** | Auto-pulled into Salary Slip via `get_additional_salary_components()` |
| **API Endpoints** | `GET/POST/PUT/DELETE /api/resource/Additional Salary` |
| **Frontend** | ✅ **COMPLETE** — CRUD list + create flow with employee and component selectors |
| **Tests** | ✅ **COMPLETE** — Jest unit test |

**Frontend Deliverables:**
- ✅ `components/payroll/additional-salary.tsx` — List + create dialog
- ✅ API methods in `lib/api-client.ts` (`get/create/update/delete Additional Salary`)
- ✅ Integrated in `app/payroll/page.tsx` as tab
- ✅ `components/payroll/__tests__/additional-salary.test.tsx`

---

### 2.3 Employee Loans
| Item | Status |
|------|--------|
| **Backend DocType** | ❌ DOES NOT EXIST — `lending` app is not installed |
| **Impact** | Salary Slip has `Salary Slip Loan` child table but it's a NO-OP without loan DocType |
| **Solution** | Create custom `Employee Loan` DocType in `hr_custom` app |
| **Frontend** | ⬜ Build — After custom DocType is created |
| **Tests** | ⬜ Write |

**Backend Work Required (hr_custom):**
```
hr_custom/
  hr_custom/
    doctype/
      employee_loan/
        employee_loan.py
        employee_loan.json
      employee_loan_repayment_schedule/
        employee_loan_repayment_schedule.py
        employee_loan_repayment_schedule.json
```

**Employee Loan Fields:**
| Field | Type | Description |
|-------|------|-------------|
| employee | Link → Employee | The borrowing employee |
| loan_type | Data | e.g. "Salary Advance", "Personal Loan" |
| loan_amount | Currency | Total loan amount |
| disbursement_date | Date | When loan was disbursed |
| repayment_method | Select | "Repay Fixed Amount Per Period" / "Repay Over Number of Periods" |
| repayment_periods | Int | Number of installments |
| monthly_repayment_amount | Currency | Per-period deduction |
| rate_of_interest | Float | Annual interest rate (0 for interest-free) |
| total_amount_paid | Currency | Sum of all repayments (read-only) |
| balance_amount | Currency | Remaining balance (read-only) |
| status | Select | Draft / Disbursed / Repaying / Closed |
| repayment_schedule | Table → Employee Loan Repayment Schedule | Child table |

**Employee Loan Repayment Schedule Fields:**
| Field | Type |
|-------|------|
| payment_date | Date |
| principal_amount | Currency |
| interest_amount | Currency |
| total_payment | Currency |
| balance_loan_amount | Currency |
| is_paid | Check |

**Frontend Deliverables:**
- `components/payroll/employee-loans.tsx` — CRUD + repayment schedule view
- API methods in `lib/api-client.ts`

---

### 2.4 Expense Claims
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists in HRMS (`Expense Claim`) |
| **How it works** | Approved claims are pulled into Salary Slip as earnings |
| **Frontend** | ⬜ Check existing `expense-list.tsx` — may need payroll integration view |
| **Tests** | ⬜ Write |

---

## Phase 3: Processing Engine

### 3.1 Salary Slip
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists with FULL calculation engine |
| **Engine** | `salary_slip.py` has complete algorithm: |
|  | 1. `get_earning_and_deduction()` — pulls from Salary Structure |
|  | 2. `get_additional_salary_components()` — pulls Additional Salary entries |
|  | 3. `calculate_lwp()` — attendance/leave without pay |
|  | 4. `calculate_net_pay()` — gross - deductions |
|  | 5. Formula evaluation via `eval()` with safe context |
| **API Endpoints** | `GET/POST/PUT/DELETE /api/resource/Salary Slip` |
| **API Methods** | `frappe.client.submit` (to submit), `frappe.client.cancel` (to cancel) |
| **Frontend** | ⬜ Build — List view + detail view + submit/cancel actions |
| **Tests** | ⬜ Write |

**Frontend Deliverables:**
- `components/payroll/salary-slips.tsx` — Filterable list (by status, employee, period)
- `components/payroll/salary-slip-detail.tsx` — Read-only detail view with earnings/deductions breakdown
- API methods in `lib/api-client.ts`

---

### 3.2 Payroll Entry (Bulk Processing)
| Item | Status |
|------|--------|
| **Backend DocType** | ✅ Exists with full wizard in HRMS |
| **How it works** | |
|  | 1. Select company, posting_date, payroll_frequency |
|  | 2. "Get Employees" — fetches employees with active SSA |
|  | 3. "Create Salary Slips" — bulk generates slips |
|  | 4. "Submit Salary Slips" — bulk submits |
|  | 5. "Make Bank Entry" — creates Journal Entry for payment |
| **API Methods** | `hrms.payroll.doctype.payroll_entry.payroll_entry.get_emp_list` |
|  | `hrms.payroll.doctype.payroll_entry.payroll_entry.create_salary_slips_for_employees` |
|  | `hrms.payroll.doctype.payroll_entry.payroll_entry.submit_salary_slips_for_employees` |
| **Frontend** | ⬜ Build — Step-by-step wizard UI |
| **Tests** | ⬜ Write |

**Frontend Deliverables:**
- `components/payroll/payroll-entry-wizard.tsx` — Multi-step wizard:
  1. **Setup**: Company, posting date, frequency, department filters
  2. **Employees**: Review employee list (checkboxes)
  3. **Generate**: Create salary slips (progress bar)
  4. **Review**: Summary of generated slips
  5. **Submit**: Bulk submit + journal entry creation
- API methods in `lib/api-client.ts`

---

## Phase 4: Post-Processing

### 4.1 Journal Entry (Accounting)
| Item | Status |
|------|--------|
| **Backend** | ✅ Auto-created from Payroll Entry via `make_payment_entry()` |
| **How it works** | Payroll Entry creates JV with debit to Salary Payable, credit to Bank |
| **Frontend** | ⬜ Build — View-only: show linked journal entries on payroll entry detail |
| **Tests** | ⬜ Write |

**Note:** No new API needed. Just display linked JV from Salary Slip / Payroll Entry.

---

### 4.2 Bank Advice
| Item | Status |
|------|--------|
| **Backend** | ✅ Report exists in HRMS (`Bank Advice`) |
| **How it works** | Generates bank advice sheet for salary payments |
| **Frontend** | ⬜ Build — Report view with export to CSV/PDF |
| **Tests** | ⬜ Write |

---

## Phase 5: Local Compliance (Tax & Insurance)

### 5.1 Payroll Compliance Policy
| Item | Status |
|------|--------|
| **Backend DocType** | ❌ NEEDS CREATION in `hr_custom` |
| **Purpose** | Per-country tax/insurance rules applied during salary slip calculation |
| **Frontend** | ⬜ Build — After custom DocType is created |

**Payroll Compliance Policy Fields:**
| Field | Type | Description |
|-------|------|-------------|
| country | Link → Country | Country this policy applies to |
| company | Link → Company | Company scope |
| effective_from | Date | Start date |
| is_active | Check | Active flag |
| tax_rules | Table → Compliance Tax Rule | Tax brackets/rates |
| insurance_rules | Table → Compliance Insurance Rule | Insurance deductions |

**Child: Compliance Tax Rule**
| Field | Type |
|-------|------|
| tax_name | Data |
| min_income | Currency |
| max_income | Currency |
| rate_percent | Percent |
| fixed_amount | Currency |
| salary_component | Link → Salary Component |

**Child: Compliance Insurance Rule**
| Field | Type |
|-------|------|
| insurance_name | Data |
| employee_contribution_percent | Percent |
| employer_contribution_percent | Percent |
| max_insurable_salary | Currency |
| salary_component | Link → Salary Component |

---

## Implementation Order (Feature by Feature)

| # | Feature | Phase | Backend | Frontend | Priority |
|---|---------|-------|---------|----------|----------|
| 1 | Salary Components | 1 | ✅ Ready | ✅ **DONE** | 🔴 Critical |
| 2 | Salary Structures | 1 | ✅ Ready | ✅ **DONE** | 🔴 Critical |
| 3 | SSA (Assignment) | 1 | ✅ Ready | ✅ **DONE** | 🔴 Critical |
| 4 | Additional Salary | 2 | ✅ Ready | ⬜ Build | 🟡 High |
| 5 | Salary Slip | 3 | ✅ Ready | ⬜ Build | 🔴 Critical |
| 6 | Payroll Entry | 3 | ✅ Ready | ⬜ Build | 🔴 Critical |
| 7 | Attendance/LWP Widget | 2 | ✅ Ready | ⬜ Build | 🟡 High |
| 8 | Employee Loans | 2 | ❌ Build | ⬜ Build | 🟠 Medium |
| 9 | Expense Claims Integration | 2 | ✅ Ready | ⬜ Enhance | 🟡 High |
| 10 | Journal Entry View | 4 | ✅ Ready | ⬜ Build | 🟢 Low |
| 11 | Bank Advice Report | 4 | ✅ Ready | ⬜ Build | 🟢 Low |
| 12 | Compliance Policy | 5 | ❌ Build | ⬜ Build | 🟠 Medium |

---

## Frontend File Structure (Target)

```
components/payroll/
  payroll-dashboard.tsx         # Main payroll landing page with stats
  salary-components.tsx         # CRUD for Salary Component
  salary-structures.tsx         # List view for Salary Structure
  salary-structure-detail.tsx   # Detail/edit view with child tables
  salary-structure-assignment.tsx # Bulk + individual SSA
  additional-salary.tsx         # CRUD for Additional Salary
  employee-loans.tsx            # CRUD for Employee Loan (custom)
  salary-slips.tsx              # List view with filters
  salary-slip-detail.tsx        # Read-only breakdown view
  payroll-entry-wizard.tsx      # Multi-step bulk processing
  payroll-analytics.tsx         # Charts and reports
  bank-advice.tsx               # Bank advice report
  compliance-policy.tsx         # Per-country tax/insurance config

app/payroll/
  page.tsx                      # Payroll module page (tab router)

lib/api-client.ts               # Payroll API methods (within FrappeAPIClient class)
lib/i18n.tsx                    # pay.* translation keys (EN + AR)
```

---

## Key Rules

1. **Never modify `apps/hrms/`** — Standard HRMS app; only read/use its API
2. **Custom doctypes go in `apps/hr_custom/`** — Employee Loan, Compliance Policy
3. **Backend first** — Verify data exists via API before building frontend
4. **Test each feature** — Unit test + integration test before moving to next
5. **i18n required** — Every UI string must have EN + AR translations
6. **shadcn/ui only** — Use existing component library, no external UI packages

---

## Status

- [x] Old payroll code deleted (frontend)
- [x] Backend confirmed — NO custom payroll code existed
- [x] HRMS backend assessed — 90% of features already available
- [x] **🎉 PHASE 1: SETUP — 100% COMPLETE ✅**
  - [x] **1.1: Salary Components** ✔️
    - Full CRUD interface with filters
    - 5 API methods
    - 50+ i18n keys (EN + AR)
    - Unit tests
  - [x] **1.2: Salary Structures** ✔️
    - List view + create dialog
    - 5 API methods
    - 50+ i18n keys (EN + AR)
    - Unit tests
  - [x] **1.3: Salary Structure Assignment** ✔️
    - Single + bulk assignment
    - Stats dashboard (total/assigned/unassigned)
    - 5 API methods
    - 45+ i18n keys (EN + AR)
    - Unit tests
  - [x] **Integration:**
    - `/payroll` page with Phase 1 tabs
    - Re-enabled in sidebar, dashboard, navigation
    - All features accessible and working
- [ ] **Phase 2: Monthly Inputs** (in progress)
  - [x] 2.1: Attendance & LWP Widget
  - [x] 2.2: Additional Salary
  - [ ] 2.3: Employee Loans (needs custom DocType)
  - [ ] 2.4: Expense Claims Integration
- [ ] Phase 3: Processing Engine
- [ ] Phase 4: Post-Processing
- [ ] Phase 5: Local Compliance
