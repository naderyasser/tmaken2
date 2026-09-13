# Cashier go-live checklist — real-device validation

Automated e2e covers programmatic offline (request blocking + `navigator.onLine`). The
steps below validate a **TRUE physical disconnect** on the customer's actual device and
printer. Run them once per device before handover; every step states its expected
outcome. (Admin diagnostics: header → نشاط/Activity icon.)

## A. Printer validation (thermal 58/80mm)
1. Connect the thermal printer (USB driver / Android RawBT / network printer) so it
   appears as a system printer.
2. Diagnostics → choose roll width (58/80mm) → **طباعة تجريبية / Test Print**.
   - ✅ Print dialog shows a NON-blank, PORTRAIT preview at roll width.
   - ✅ Paper output: header, Arabic item names (incl. wrapped long name), decimal qty
     2.5, totals, payment, change, footer — correctly right-to-left.
3. Make a real sale → receipt sheet → اطبع/Print.
   - ✅ Same as above, plus invoice number; with a VAT number configured, the ZATCA QR
     square prints and scans.
4. X-report → print; Reports → print. ✅ Both portrait at roll width.
5. ESC/POS raw printers without a driver: install **RawBT** (Android) or **QZ Tray**
   (Windows) and set it as the default printer — the app prints through the normal
   browser dialog; no app changes needed. Validate step 2 again through it.

## B. TRUE offline validation (physical)
Prep (online): log in as the cashier, open a session, open the checkout once, and open
History once (caches + shell precache). Diagnostics should show: shell cached ✅ 6/6,
catalog count > 0, SW active.

1. **Disconnect for real**: turn OFF Wi-Fi / pull the Ethernet cable / enable airplane
   mode on the till device.
2. Close the browser COMPLETELY (swipe away / quit). Reopen → go to the cashier URL.
   - ✅ App opens from cache (no error page), header shows غير متصل/Offline + banner.
3. Sell: scan a barcode (✅ beep + item added from the local catalog), add 2-3 items,
   take a cash payment with overpay (✅ change computed), finish.
   - ✅ Receipt shows a `LOCAL-XXXXXXXX` provisional number; printing works offline.
4. Repeat for 3 sequential sales.
   - ✅ The header badge counts بانتظار المزامنة 1 → 2 → 3; History lists all three
     with the pending badge; nothing errors.
5. Close the tab mid-cart with items + an open payment sheet; reopen.
   - ✅ Cart and entered payment restore exactly.
6. **Reconnect for real** (Wi-Fi back on).
   - ✅ Within seconds the badge drains to متصل/Online; History now shows real
     `ACC-PSINV-*` numbers replacing the LOCAL ones; Diagnostics "last successful
     sync" updates.
   - ✅ Server check (back office): exactly 3 new invoices — no duplicates.
7. Flap test: toggle Wi-Fi off/on twice during a sale burst.
   - ✅ Queue drains fully; invoice count on the server matches sales made exactly.

## C. Stock & data before opening day
- The cashier sells from warehouse **configured in Cashier Settings** — verify it is
  the SHOP warehouse (currently a sales-van warehouse is configured) and enter opening
  stock (Stock Entry → Material Receipt). Until then most items show غير متوفر and the
  «إخفاء غير المتوفر» filter hides them.
- Diagnostics → تنظيف بيانات الاختبار: run **Dry run** first (lists exactly what will
  be touched), review, then the armed run. Test invoices are removed; test items and
  the TEST customer are only DISABLED (reversible).

---

## D. In-app diagnostics (manager tools — header → Activity icon)
These supplement, and do NOT replace, the physical test in §B.

### D.1 Setup check (read-only — Issue 1 blocker)
The diagnostics panel auto-flags the two config blockers (it never changes the warehouse
or writes stock):
- **Wrong warehouse**: the configured Default Warehouse looks like a sales-rep/van
  warehouse (e.g. «Nader Yasser - Van»). → Set the SHOP warehouse in Cashier Settings →
  Default Warehouse.
- **Low sellable count**: very few items are in stock. → Enter opening stock via Stock
  Entry → Material Receipt for the shop warehouse.
The panel also shows the warehouse name and a sellable-items count. ✅ Resolve both
before opening day; the warnings disappear once fixed.

### D.2 Offline self-test (Issue 2 — in-app)
Diagnostics → **Run self-test**. It runs, with a pass/fail per step:
1. App shell cached 6/6  2. Sale queued locally  3. Synced to a real `ACC-PSINV-*`
invoice (if offline, it waits — reconnect to continue)  4. Local queue drained to 0
5. Test invoice cleaned up.
- ✅ All five green = the offline→online round-trip works on THIS device. The test
  invoice it creates is tagged `selftest-…` and auto-removed (it can never touch a real
  sale). **This does not replace §B** — still run the physical airplane-mode test.

## E. Test-data purge — owner sign-off (Issue 3)
Before handover: Diagnostics → تنظيف بيانات الاختبار → **Dry run (list only)**. The dry run
now shows an EVIDENCE TABLE per flagged invoice — id, date, total, and WHY it was flagged
(“created by the test user” and/or “test items only”). Review it WITH THE SHOP OWNER and
confirm each row is genuinely test data, not a real early transaction. Only then run the
armed purge. An invoice that contains ANY real item is never flagged (safety boundary).
Test items and the TEST customer are DISABLED (reversible), not deleted; confirmed test
invoices are removed.

As of this build the dry run flags ACC-PSINV-2026-00050..00055 — all created by
`Administrator` (verification scripts, not a real cashier) and composed only of the test
items `POS-E2E-SERVICE` / `AQAR-FEATURED-AD`. **STATUS: NOT yet purged** — left in place
deliberately for the owner to confirm and run the in-app purge at handover.

## F. Payment-method names (Issue 3 minor)
Mode-of-Payment labels now follow the UI language on screen and on printouts (e.g.
«بطاقة ائتمان» ⇄ "Credit card") via a display-name map — the underlying Mode of Payment
records are NOT renamed. Unmapped/custom methods show their stored name unchanged.
