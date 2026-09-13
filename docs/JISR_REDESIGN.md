# Tamkeen HR → Jisr Redesign — Staging-Ready Reference

Branch `feat/jisr-redesign`. **Staging: https://staging.base.meena.sa** (login **hr@jisr-staging.test / JisrStaging#2026**).
**Live qarawi / `:3000` / `:8000`-restart / qarawi-DB were NEVER touched** — everything is on `:3200` (frontend worktree) + the `test` canary site (backend). Final build `0muyBXTaNYzDRcivnl4KY`.

## What's on staging (final sweep: 30/30 screens load clean)

### Part A — UI/UX alignment (visual layer)
One shared Jisr-style shell across **every** HR page (fixed the old `/hr`-vs-`/employees` nav split): slim right-side icon rail (RTL) with grouped sections + hover flyouts, top bar (⌘K search, company switcher, language, notifications, account), neutral-airy palette with Tamkeen deep-teal `#0E6E62` accent, card dashboards, pill tabs, segmented controls, status chips, shared DataTable, side drawers, skeletons. Shared design tokens + component kit (`components/shared/*`), shell (`components/hr-shell/*`). Arabic-first RTL **and** English LTR both verified. WCAG-minded (focus rings, aria, contrast).

### Part B — Feature parity (F1–F14)
| # | Feature | Implementation |
|---|---|---|
| F1 | Requests & Approvals hub (My Requests / Tasks / My Approvals / Team Requests), named multi-step approval chain + per-step audit, "on behalf" flow, 10 request types | `hr_approval_flow` sidecar doctype + `approvals_api` + `/requests` |
| F2 | Tasks engine | Tasks tab reuses `workflow_tasks` |
| F3 | Violations register — catalog, evidence attach, reporter+subject, 5 states (Planned/Applied/Grievance Accepted/Invalidated/Exempted), All/Open/Closed/Exempted filters, penalty link | `violation_category` + `violation_status` field + `violations-register.tsx` |
| F4 | 360° tabbed profile (Overview/Data/Salary/Attendance/Leaves/Documents/Custody/Violations) + interactive org chart (reports_to) + length-of-service + doc-expiry/contract alerts | `profile-360/*`, `org-chart.tsx`, `org_chart.py` |
| F5 | Payroll & financials — components, salary-change history, GOSI 11%/9% + registered wage, bank/IBAN, CCHI, advances ledger, payslip | `payroll_summary.py` + Salary tab (display-only) |
| F6 | Saudi leave — balances, statutory types, sick-leave tiers (30@100/60@75/30@0) | `leave_summary.py` + Leaves tab (display-only) |
| F7 | Attendance→payroll pipeline — 8 KPI tiles, review queue, per-employee monthly detail (calendar + Log/Fingerprints/Requests/Payroll tabs), readiness | `pipeline_api.py` + `attendance-pipeline.tsx` |
| F8 | Multi-dimensional attendance filters (dept/manager/branch/location) | pipeline FilterBar |
| F9 | Analytics hub — 9 report templates grouped by category, Excel/PDF/CSV/Print export | `report_hub/*` + `/hr/analytics` |
| F10 | Data import/export — template download, dry-run validation, guarded write | `import_api.py` + `/hr/import` |
| F11 | Self-service `/me` (employee + manager): quick actions, approvals inbox, my-requests, leave/payslip widgets, team attendance, occasions, doc-expiry; reduced rail for plain employees | `my_dashboard.py` + `/me` |
| F12 | Announcements enhanced — Important flag, multi-attachment, read receipts (seen-by-N), publish window, targeting | announcement custom fields + receipt doctype + `announcements_api.py` |
| F13 | Employee list — lifecycle segments (Active/New Hires/Probation/Terminated) w/ counts, saved views, column show/hide, advanced filters, bulk update | `employee_directory.py` + shared DataTable |
| F14 | Documents + expiry tracking; 4-level roles (Employee / Manager / HR Supervisor / HR Admin) | `document_expiry.py`, `scope.py` (data-derived manager via reports_to — no new Frappe role) |

## Regression — existing Tamkeen features intact (30/30 load clean under new shell; backends untouched)
Geolocation tracking ✅ · geofence radius alerts ✅ · biometric/ZKTeco ✅ · auto-attendance ✅ · shift management + calendar ✅ · attendance + report ✅ · payroll (all existing tabs) ✅ · leaves + setup ✅ · custody ✅ · contracts ✅ · onboarding ✅ · expenses ✅ · announcements ✅ · HR settings ✅ · branches ✅ · HR team + company users ✅ · HR-managers ✅ · employee-report ✅. Every `?module=` value + the redirect trio (salaries→/payroll, shifts→/shift-management, /hr-settings→settings) preserved. Rich employee profile preserved as the **Data** tab (form unchanged).

## Assumptions / DISABLED pending HR sign-off (verified on-screen)
- **Sick-leave 75%/0% auto-deductions: NOT enabled.** Tiers shown as read-only policy; `deduction_enabled:false`. The `/me` leave card and F4 Leaves tab literally display *"calculations disabled pending HR sign-off."*
- **All payroll/GOSI/leave calculations are read-only** (`calc_disabled:true`) — stored values surfaced; nothing computed or posted.
- **Attendance→payroll auto-posting DISABLED** — the pipeline "Approve" action returns/shows "auto-posting disabled pending HR sign-off" and posts nothing.
- **Import defaults to dry-run**; writes only on an explicit, labeled toggle (HR-gated, per-row error isolation).
- No unsupported check-in methods (passcode/card) built.
- Manager = data-derived from `Employee.reports_to` (no new role). GOSI 11%/9% shown as configured, not auto-applied.
- **Staging limitation**: doc_events (auto-triggers on desk-created docs) aren't active on staging (no `:8000` restart) — flows are exercised via explicit in-app actions; the guarded `hooks.py` wiring is packaged for cutover.

## Exactly what a live deploy (cutover) will change — NOT done without written "deploy to live"
1. **Frontend**: build `feat/jisr-redesign` and restart `:3000` (or promote the worktree build) → live qarawi HR gets the new shell + all features. (Currently reverted to pre-redesign.)
2. **Backend**: apply the new files in `scratchpad/backend_manifest.md` + the guarded shared-file edits (hooks.py doc_events, permission.py `ess` module) into the main `base_meena`, then **migrate every tenant site incl. qarawi** (backup-first, canary-first) → creates the new doctypes/fields (approval flow, violation category/status, announcement receipts, compliance-doc fields, etc.) and wires doc_events.
3. Employees see the redesign; HR gets the new hubs. Disabled calculations stay disabled until separately signed off.
Nothing else on the server is affected; non-HR verticals are out of scope and unchanged.
