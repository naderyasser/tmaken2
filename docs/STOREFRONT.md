<div align="center">

<img src="../public/brand/logo.svg" alt="تمكين العقارية — Tamkeen Real Estate" width="240" />

# تمكين العقارية — واجهة السوق · Storefront

**واجهة Next.js للسوق العقاري السعودي المتوافق مع REGA**
*The Next.js storefront for the REGA-compliant Saudi real-estate marketplace.*

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square)](https://nextjs.org)
[![RTL First](https://img.shields.io/badge/RTL-first-D4AF5F?style=flat-square)](#)
[![Dark Mode](https://img.shields.io/badge/dark%20mode-✓-151816?style=flat-square)](#)
[![E2E](https://img.shields.io/badge/Playwright-28%20passing-2E9B72?style=flat-square)](./FULL_TEST_REPORT.md)

🌐 [aqar.meena-alaqariya.com](https://aqar.meena-alaqariya.com)

</div>

---

> 📖 **هذا دليل مختصر.** القصّة الكاملة للمنتج والأعمال والامتثال والمعمارية موجودة في **الملف الرئيسي (مستودع الخلفية):**
> **This is the light companion doc.** The full product / business / compliance / architecture story lives in the **flagship README (backend repo):**
>
> 👉 **[`base_meena/real_estate/README.md`](../../apps/base_meena/base_meena/real_estate/README.md)** — تمكين العقارية (flagship)

---

## ما الذي يعيش هنا — What lives in the frontend

واجهة السوق هي وحدة داخل واجهة الـ ERP متعدّدة المستأجرين، معزولة تحت `app/store`. تعمل في **وضع السوق** (marketplace mode) المُحدَّد بالنطاق عبر middleware، وتُجلب صفحاتها من الخادم مع تخزين **ISR**.

| المسار — Path | المحتوى — What it is |
|---|---|
| `app/store/page.tsx` | الصفحة الرئيسية — home (RTL · cards · region chips) |
| `app/store/search/page.tsx` | بحث الخريطة — split map + list, price-pin clusters |
| `app/store/listing/[id]/` | صفحة الإعلان — gallery · REGA block · QR · map (+ branded `error.tsx`) |
| `app/store/[city]/[district]/` | صفحات المدن والأحياء — city / district landing |
| `app/store/post/page.tsx` | معالج النشر — guest post-ad wizard (OTP → details → map → photos → license) |
| `app/store/offices/page.tsx` | دليل المكاتب — offices directory |
| `app/store/advertiser/[id]/` | ملف المعلن — public advertiser profile |
| `components/store/*.tsx` | مكوّنات السوق — 13 storefront components |
| `lib/frappe-server.ts` | جلب من الخادم + ISR — `store.*` server wrappers |
| `lib/real-estate-api.ts` | عميل الواجهات — client API (`frappeClient`) |
| `lib/arabic.ts` · `lib/motion.ts` | تطبيع عربي · مُحمِّل GSAP الكسول + احترام `prefers-reduced-motion` |
| `e2e/real-estate-*.spec.ts` | اختبارات Playwright — E2E specs (28 journeys / 7 files) |

---

## التشغيل — Run it

```bash
npm install
npm run dev          # storefront + ERP UI

# E2E (against a running storefront on :8080)
STORE_URL=http://localhost:8080 npx playwright test e2e/real-estate-*.spec.ts --project=chromium
```

**نقاط تصميم — Design notes**

- **عربي أولاً، RTL دائماً** — `<html lang="ar" dir="rtl">` على السوق، أرقام `tabular-nums`، الهاتف `dir="ltr"` داخل RTL.
- **الوضع الليلي** عبر متغيّرات CSS (`.aqar-store.dark`) + كوكي `aqar-theme` بلا وميض (no-FOUC) مع الحفاظ على ISR.
- **حركة منضبطة** — GSAP يُحمَّل ككسول (lazy chunk) على صفحة البحث فقط؛ كل الحركات transform/opacity وتُعطَّل مع `prefers-reduced-motion`.
- **الخصوصية** — رقم المعلن لا يصل المتصفّح؛ واتساب يمرّ بإعادة توجيه من الخادم.

---

## الاختبارات — Tests

تقرير الاختبارات الكامل (الخلفية + E2E + الامتثال + الأداء): **[`docs/FULL_TEST_REPORT.md`](./FULL_TEST_REPORT.md)**.

<sub>الواجهة الأمامية جزء من منصّة ERP متعدّدة المستأجرين أوسع — راجع [`README.md`](../README.md) للوحدات الأخرى (موارد بشرية، نقاط بيع، محاسبة…). The frontend is part of a wider multi-tenant ERP — see the repo [`README.md`](../README.md) for other modules.</sub>
