# Apex parity — tamken3 (2026-09-29/30)

Target: `tamken3.base.meena.sa/hr` · reference: Apex ERP (`login.erp-apex.com`), Apex = source of truth.
Everything below is **live on tamken3** (tenant-scoped: site flags `hr_live_punch_feed`, `hr_apex_parity`;
other tenants unchanged). Screenshots: `docs/apex-parity/ours-*.jpg` (live tamken3, real data only).
Apex reference shots are on the server at `/home/frappeuser/tamken3-audit/apex/live/shots/apex-*.jpg`
(not committed — they contain Apex's customer data).

| Commit | Repo / branch | What |
|---|---|---|
| `d18949c`, `a6f600d` | base-meena apps · `fix/adms-clock-skew-2026-09-29` | never drop punches: handshake `TimeZone=`, clock offset, held punches, unrouted spool |
| `7643088` | base-meena apps · `feat/apex-parity-tamken3` (= `apex-clone`) | dashboard endpoint, live feed, clock hardening, tenant-scoped parity backend |
| `d661217`, `b0db964` | tmaken2 frontend · `feat/apex-dashboard-live` (= `apex-clone`) | dashboard, realtime, dialogs, pages |

## 0. Test data — removed

Seed + simulator data (my test run, 2026-09-30 00:13–01:17) was deleted after the user's OK
(backup first: `sites/tamken3/private/backups/20260930_012745-tamken3-database.sql.gz`):

| Doctype | Deleted |
|---|---|
| Employee Checkin | 476 |
| Biometric Device Log (SIMTK3A/B/C only) | 56 |
| Employee (HR-EMP-00001…36) | 36 |
| Attendance | 11 |
| Branch (the 4 names copied from Apex's customer) | 4 |
| Biometric Device «جهاز محاكاة — …» | 3 |
| Shift Type «دوام صباحي/مسائي (تجريبي)» | 2 |
| Holiday List «قائمة العطل 2026 (تجريبي)» | 1 |
| Leave Type «ظز», «P7TEST2» (27-09, not from my seed) | 2 |

Kept: device **RKQ4253400264 «التحكم التقني»** and its 2 logs (recovered PIN 5000 punches, 29-09 17:57:23 / 18:15:32).
Naming series HR-EMP / EMP-CKIN / HR-ATT reset to 0. After cleanup tamken3 has 0 employees/checkins/attendance/branches/shifts.
No simulator, cron or scheduler job exists; the staging stack used for tests is stopped.

## 1. Global dialog pattern ✅ (already correct)

Every add/edit dialog is `ApexDialog`: centred title, **× icon** top-left, ONE green «اضافة» / «حفظ», no «اغلاق» button.
The audit's `[اغلاق]` is the × icon's accessible name (`aria-label`), not a text button — see `ours-jobs-add.jpg`.

## 2. Dialogs

| Dialog | Apex | Before | After |
|---|---|---|---|
| اضافة وظيفة | اسم الوظيفة بالعربية *, بالانجليزية, الحالة (نشط/غير نشط), ملاحظات | اسم الوظيفة *, الوصف | ✅ exact (Designation `custom_name_en/status/notes`, tamken3 only) |
| اضافة فرع | 15 fields, Apex order | missing EN name/مجموعات/الدولة order; extra الرمز البريدي/الفاكس | ✅ exact order; postal/fax dropped from form (data kept) |
| إضافة دوام | اسم الدوام بالعربية * … نوع الدوام | «*» present (span, not `<label>`) | ✅ |
| اضافة المشروع | title «اضافة المشروع» | «اضافة مشروع» | ✅ |
| اضافة مهمة | اسم المهمة بالعربية * / بالانجليزية | (عربي)/(إنجليزي) | ✅ |
| اضافة مجموعة المواقع | اسم مجموعة المواقع بالعربيه * / بالانجليزية | (عربي)/(إنجليزي) | ✅ |
| إضافة مجموعة الموظفين | … بالعربيه * / بالانجليزي | (عربي)/(إنجليزي) | ✅ |
| اضافة جنسية | اسم الجنسية بالعربية * / بالانجليزية | (عربي)/(إنجليزي) | ✅ |
| اضافة عطلة رسمية | … الرسمية بالعربية * / بالانجليزية, من *, إلى * | (عربي)/(إنجليزي) | ✅ |
| اضافة اجازة (انواع) | اسم الاجازة بالعربية * / بالانجليزية | (عربي)/(إنجليزي) | ✅ |
| اضافة اجازة (موظف) | الموظف *, نوع *, من *, إلى *, ملاحظات | = | ✅ |
| اضافة اذن | الموظف, التاريخ (rest after employee) | + ملاحظات | ✅ ملاحظات removed from form |
| اضافة حركة | الموظف *, التاريخ, الوقت, الجهاز, كلمة مرور المسؤول (eye) | + نوع الحركة, no password on add | ✅ password verified server-side; IN/OUT from the day's punch order |
| الطلبات → اضافة اجازة | «اضافة اجازة» | «اضافة اضافة اجازة» | ✅ |
| اضافة مستخدم / صلاحية / دوام رمضان | — | = | ✅ |
| اضافة موقع | title «اضافة موقع» | «اضافة المواقع» | ✅ |
| اضافة جهاز | الاسم بالعربية *, بالانجليزية, الفرع *, الرقم التسلسلي | — | ✅ (serial kept required — needed for routing) |

Table headers were pinned to their previous text (`tableLabel`) so the already-matching lists did not change.

## 3. اضافة موظف ✅ (`ours-employee-new.jpg`)

Sections تعريف الموظف · معلومات الموظف · معلومات شخصية · إعدادات إحتساب الإضافي; breadcrumb + «اغلاق» + «اضافة».
Required = كود الموظف, حالة الموظف, اسم الموظف بالعربية, صلاحية الموظف بالفروع, الفروع, الدوام, طريقة الحضور
(«الوظيفة» no longer required — supersedes the client's 2026-09-20 five-field rule). «الجنس» removed.
«الجنسية» lists the الجنسية master with Arabic names (same labels as the Nationality page), not ISO English.
Overtime: the 5 Apex checkboxes. حالة الموظف defaults to نشط (options نشط/غير نشط/موقوف/منتهي).

## 4. Pages

| Page | After |
|---|---|
| /employees | ✅ «رقم البصمة» column removed (field stays in the form + «بلا رقم بصمة» filter) |
| موظفين غير مسجلين | ✅ «البيانات الناقصة» → tooltip on the name; unmapped-PIN panel («ربط الكل», «ربط 5000») moved here from الاجهزة; unknown PIN name «???? ????» |
| الاجهزة | ✅ Apex table only (م · الرقم التسلسلي · اسم الجهاز · فرع · الحالة «اخر ظهور: DD-MM-YYYY HH:mm» · الاجراءات); clock-skew warning + «ضبط فرق الساعة» (enhancement) |
| إلغاء ترحيل الحركات | ✅ already two fields «من تاريخ *» / «إلى تاريخ *» + تحديد الموظفين (`ours-cancel-transactions.jpg`) |
| حركات المستخدمين | ✅ already من/إلى + «اخفاء البحث» + «الطباعة» (`ours-user-transactions.jpg`) |
| تفعيل دوام رمضان | ✅ toolbar الطباعة · اضافة · «تفعيل اول دوام رمضان», no حذف |
| اعدادات الحضور و الانصراف | ✅ plain number inputs + checkboxes + حفظ (no طي/زيادة/إنقاص) |

## 5. Dashboard (/hr) — `ours-dashboard.jpg`, `ours-dashboard-live-punch.jpg`

| Item | Apex | After |
|---|---|---|
| Endpoint | one screen | ✅ `base_meena.api.hr_dashboard.get_dashboard` (branch-scoped; old `attendance_overview` untouched) |
| Day | always today | ✅ (no fallback to an earlier day) |
| Cards | 5, icon + label + count; حضور #2960b6, الغياب #ff0000, عطله إسبوعية/عطلات رسمية #808080, الاجازات #2eaf7d | ✅ one row, tinted-square icons |
| «عرض …» modal | الكود · الاسم · الفرع · الدوام + إلغاء | ✅ (+ الطباعة) |
| Donut | total centre; present #497cff, absent #dc3545, leave #34c75a, waiting #ffb62e, weekly #9d9fa0 | ✅ |
| Title | «حركات يوم <day> YYYY-MM-DD», 1.5rem, animated icon | ✅ (+ live dot) |
| Movements table | right-aligned, 50×50 avatar, MM/DD/YYYY HH:mm:ss, name tooltip, device branch as الموقع | ✅; unknown PIN = «???? ????» / code = PIN; ⚠ on clock-skew rows |
| Branch chart | stacked, Apex order (branch id), full names 45°, title 1.5rem/500 | ✅ creation order |
| Last 10 days | grouped, the 10 days before today, oldest left, Y left | ✅ |
| Semantics | «الغياب» only once absence is posted; otherwise «في الانتظار» (Apex API: past days show waiting 35–43) | ✅ |
| Live | SignalR «AttandanceLog» → row unshift | ✅ socket.io `hr_attendance_punch` → prepend + highlight, refresh cards (2s debounce), 60s polling fallback, auto-reconnect; branch-scoped per HR user |
| Apex bugs | hidden invoice footer, Y capped 50, truncated labels | not copied |

Realtime was **never working before**: the client connected to namespace `/<hostname>` while Frappe
publishes to `/<site>` («Invalid namespace»). Fixed in `lib/frappe-realtime.ts` (`NEXT_PUBLIC_FRAPPE_SITE`).

## Punches (never lost)

* Root cause of the rejected punches: ZKTeco firmware sets its clock from our HTTP `Date` header + its TimeZone
  option (default GMT+8); our handshake sent none → devices ran exactly +5h. Handshake now sends `TimeZone=3`.
* Offsets are learnt only from consistent real-time evidence, only for clocks that are **ahead** (a future stamp
  can't be a backlog); a push that disagrees with the active offset is **held** (fixed device vs backlog), never
  guessed; offset drops to 0 when the device reads correctly; history of every offset period kept.
* Pushes from unrouted devices are spooled (`config/adms_unrouted/<SN>.jsonl`), never answered OK and discarded.
* Linking an employee to a device ID replays that ID's unmatched punches and re-posts the affected days.

## Tests

* Staging e2e (13/13): socket connects; known PIN, unknown PIN, skewed +5h (held → learnt → corrected), device
  fixed (held → offset back to 0), duplicate (no row), offline backlog — each visible in 0.2–1.7 s (replay case 3.3 s),
  all rows persist after refresh, «عرض حضور» modal, no console errors.
* **Live tamken3** (temporary generic device `TEST-DEV-01`, PIN 99999, removed afterwards): gateway push → row
  in **0.94 s**, direct push → **0.60 s**, both persist after refresh, no page errors.
* Smoke after deploy: tamkeen-v2, qarawi(-hr), base.meena.sa, demo-erp respond; 0 Error Log on tamken3/qarawi.

## Open

* **SPK7252400286** pushes daily but has no route (≈613 punches since 15-09, possibly since 09-05) — now spooled;
  needs its tenant, then re-pull via ATTLOG stamp.
* **MFP3255001813 +24h** (qarawi, 2026-05-04): 1 attendance punch (PIN 8, unmapped) — proposed −1 day, awaiting OK.
* Real-device verification of `TimeZone=3` (next punch should arrive with skew ≈ 0).
