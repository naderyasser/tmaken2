# 📱 توثيق كامل لتطبيق مندوب المبيعات (Sales Rep Mobile App)

## Complete Frontend Documentation for Rebuilding

> **الهدف**: هذا المستند يحتوي على كل التفاصيل اللازمة لإعادة بناء التطبيق بالكامل بنفس الـ Features والتصميم.
> 
> **التطبيق موجود بالفعل في**: `/crm-micro-4/` وهو مبني بـ **Next.js 15 + TypeScript + Tailwind CSS 4 + shadcn/ui (new-york style)**

---

## 📋 فهرس المحتويات

1. [نظرة عامة على المشروع](#1-نظرة-عامة-على-المشروع)
2. [Tech Stack والتبعيات](#2-tech-stack-والتبعيات)
3. [هيكل المشروع الكامل](#3-هيكل-المشروع-الكامل)
4. [ملفات الإعداد (Configuration)](#4-ملفات-الإعداد-configuration)
5. [نظام الألوان والتصميم (Theme & Design System)](#5-نظام-الألوان-والتصميم-theme--design-system)
6. [أنواع البيانات (TypeScript Types)](#6-أنواع-البيانات-typescript-types)
7. [نظام إدارة الحالة (State Management - Context)](#7-نظام-إدارة-الحالة-state-management---context)
8. [الصفحات والمسارات (Pages & Routes)](#8-الصفحات-والمسارات-pages--routes)
9. [مكونات UI المستخدمة (UI Components)](#9-مكونات-ui-المستخدمة-ui-components)
10. [تفاصيل كل صفحة بالكامل](#10-تفاصيل-كل-صفحة-بالكامل)
11. [منطق الأعمال (Business Logic)](#11-منطق-الأعمال-business-logic)
12. [الصور والأصول (Public Assets)](#12-الصور-والأصول-public-assets)
13. [CSS Animations](#13-css-animations)
14. [دليل التشغيل والنشر](#14-دليل-التشغيل-والنشر)

---

## 1. نظرة عامة على المشروع

### ما هو التطبيق؟
تطبيق موبايل (Mobile-first) لمندوب المبيعات الميداني يعمل في بيئة توزيع المنتجات. التطبيق يمكّن المندوب من:

- **عرض العملاء القريبين** مع معلوماتهم (الاسم، الموقع، المسافة، الهاتف، آخر زيارة)
- **إدارة مخزون المندوب الشخصي** (نشط / رجيع / تالف / منتهي الصلاحية) مع نظام Batches
- **إضافة عميل جديد** مع تحديد الموقع تلقائياً
- **إنشاء طلب** لعميل قائم أو جديد (اختيار منتجات من batches)
- **تحديث مخزون العميل** عند الزيارة (كم بقي عنده)
- **سحب منتجات من العميل** (رجيع / تالف / منتهي الصلاحية / إلخ)
- **إنشاء فاتورة** مع خصومات وضريبة 15% VAT
- **عرض سجل حركات المخزون**
- **تسجيل أسباب عدم البيع** إذا رفض العميل

### اللغة والاتجاه
- **اللغة**: عربية بالكامل
- **الاتجاه**: RTL (من اليمين لليسار)
- **`lang="ar"` و `dir="rtl"`** على عنصر `<html>`

### شكل التطبيق
- **Mobile-first** بعرض أقصى `430px`
- على Desktop: يظهر في إطار هاتف (Phone Frame) مع notch وحواف مستديرة
- الخلفية على Desktop: gradient من `slate-100` إلى `blue-50`

---

## 2. Tech Stack والتبعيات

### Core Framework
| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| **Next.js** | 15.5.9 | App Router (RSC + Client Components) |
| **React** | 18.2.x | UI Library |
| **TypeScript** | 5.9.3 | Type Safety |
| **Tailwind CSS** | 4.1.9 | Styling |
| **PostCSS** | 8.5.6 | CSS Processing |

### UI Library
| المكتبة | الإصدار | الغرض |
|---------|---------|-------|
| **shadcn/ui** | new-york style | UI Components |
| **@radix-ui/\*** | متعددة | Headless UI Primitives |
| **lucide-react** | 0.545.0 | Icons |
| **class-variance-authority** | 0.7.1 | Component Variants |
| **clsx** | 2.1.1 | Conditional Classes |
| **tailwind-merge** | 3.3.1 | Merge Tailwind Classes |

### Utilities
| المكتبة | الإصدار | الغرض |
|---------|---------|-------|
| **date-fns** | 2.30.0 | Date Utilities |
| **react-day-picker** | 8.10.1 | Date Picker |
| **tw-animate-css** | 1.4.0 | Tailwind Animations |

### `package.json` الكامل
```json
{
  "name": "timer-dashboard",
  "version": "1.0.0",
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "lint": "next lint",
    "start": "next start"
  },
  "dependencies": {
    "@radix-ui/react-checkbox": "1.3.3",
    "@radix-ui/react-dialog": "1.1.15",
    "@radix-ui/react-label": "2.1.8",
    "@radix-ui/react-popover": "1.1.6",
    "@radix-ui/react-progress": "1.1.7",
    "@radix-ui/react-radio-group": "1.2.3",
    "@radix-ui/react-select": "2.2.6",
    "@radix-ui/react-separator": "1.1.8",
    "@radix-ui/react-switch": "1.1.3",
    "@radix-ui/react-tabs": "1.1.13",
    "@radix-ui/react-toast": "1.2.15",
    "@radix-ui/react-toggle-group": "1.1.11",
    "@radix-ui/react-tooltip": "1.2.8",
    "@tailwindcss/postcss": "^4.1.9",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "date-fns": "^2.30.0",
    "lucide-react": "0.545.0",
    "next": "15.5.9",
    "react": "^18.2.0",
    "react-day-picker": "8.10.1",
    "react-dom": "^18.2.0",
    "tailwind-merge": "3.3.1",
    "tailwindcss-animate": "1.0.7",
    "tw-animate-css": "1.4.0"
  },
  "devDependencies": {
    "@types/node": "24.7.2",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.2",
    "postcss": "8.5.6",
    "tailwindcss": "^4.1.9",
    "typescript": "5.9.3"
  }
}
```

---

## 3. هيكل المشروع الكامل

```
crm-micro-4/
├── app/
│   ├── globals.css                          # Global CSS مع المتغيرات والأنيميشن
│   ├── layout.tsx                           # Root Layout (RTL + InventoryProvider)
│   ├── page.tsx                             # الصفحة الرئيسية (Dashboard)
│   └── sales-rep/                           # ← 🔥 تطبيق المندوب
│       ├── layout.tsx                       # Phone Frame Layout
│       ├── page.tsx                         # Dashboard المندوب (العملاء + مخزوني)
│       ├── new-order/
│       │   ├── page.tsx                     # صفحة الطلب الجديد (1127 سطر)
│       │   └── loading.tsx                  # Loading State
│       ├── invoice/
│       │   └── page.tsx                     # صفحة الفاتورة
│       ├── customer-inventory/
│       │   ├── page.tsx                     # مخزون العميل
│       │   └── loading.tsx                  # Loading State
│       └── inventory-records/
│           └── page.tsx                     # سجل حركات المخزون
├── components/
│   └── ui/                                  # shadcn/ui Components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── tabs.tsx
│       └── ... (60+ UI components)
├── contexts/
│   ├── InventoryContext.tsx                  # 🔥 State Management للمخزون
│   └── TimeContext.tsx                       # Timer Context (للداشبورد الرئيسي)
├── types/
│   ├── inventory.ts                         # 🔥 TypeScript Types للمخزون
│   └── modules.ts                           # أنواع الموديولات
├── lib/
│   ├── utils.ts                             # cn() utility function
│   └── validation.ts                        # Validation utilities
├── hooks/
│   ├── use-toast.ts                         # Toast hook
│   └── use-mobile.ts                        # Mobile detection hook
├── styles/
│   └── globals.css                          # Alternate global styles
├── public/                                  # Static assets
│   ├── olive-oil-bottle.png
│   ├── rice-bag.png
│   ├── sugar-bag.jpg
│   ├── tea-box.jpg
│   ├── pasta-box.png
│   ├── rich-tomato-sauce.png
│   ├── placeholder.svg
│   └── ...
├── next.config.mjs
├── tsconfig.json
├── postcss.config.mjs
├── components.json                          # shadcn/ui config
└── package.json
```

---

## 4. ملفات الإعداد (Configuration)

### `next.config.mjs`
```javascript
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,   // يتجاهل أخطاء TypeScript عند البناء
  },
  images: {
    unoptimized: true,         // لا يستخدم Image Optimization
  },
}
export default nextConfig
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "target": "ES6",
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]          // Path alias: @ = project root
    }
  }
}
```

### `postcss.config.mjs`
```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

### `components.json` (shadcn/ui)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

---

## 5. نظام الألوان والتصميم (Theme & Design System)

### CSS Variables (في `app/globals.css`)
```css
@import "tailwindcss";

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;            /* أزرق - اللون الرئيسي */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;            /* أحمر - للتحذيرات */
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}
```

### الألوان المستخدمة بشكل مباشر
| اللون | الاستخدام | Tailwind Class |
|-------|----------|----------------|
| **Blue 600/700** | Header gradient, Primary buttons | `from-blue-600 via-blue-700 to-indigo-800` |
| **Emerald** | عميل فعال badge | `bg-emerald-100 text-emerald-700` |
| **Blue light** | عميل محتمل badge | `bg-blue-100 text-blue-700` |
| **Green** | مخزون نشط، وارد | `bg-green-100/500/600`, `border-green-200` |
| **Orange** | رجيع، مسحوبات | `bg-orange-50/100/500/600`, `border-orange-300` |
| **Red** | تالف، صادر | `bg-red-100/500/600`, `border-red-200` |
| **Yellow** | منتهي الصلاحية، "خلص" | `bg-yellow-50/500/600`, `border-yellow-200` |
| **Slate** | خلفيات، نصوص ثانوية | `bg-slate-50/100`, `text-slate-500/800` |

### نمط التصميم (Design Patterns)
- **زوايا مستديرة كبيرة**: `rounded-2xl` (16px) للبطاقات، `rounded-[2rem]` للـ header
- **ظلال**: `shadow-lg`, `shadow-sm` للبطاقات
- **Padding**: `px-5 py-5` للحاويات
- **Phone Frame على Desktop**: عرض أقصى 430px مع إطار هاتف
- **Sticky Headers**: `sticky top-0 z-10`
- **Fixed Bottom Bar**: `fixed bottom-0 left-0 right-0`
- **Backdrop Blur**: `backdrop-blur-sm` في عناصر شفافة
- **Gradients**: `bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800`

---

## 6. أنواع البيانات (TypeScript Types)

### `types/inventory.ts` - الملف الكامل
```typescript
// أنواع المخزون
export type InventoryType = "active" | "damaged" | "expired" | "return"

// دفعة منتج (Batch)
export interface ProductBatch {
  batchId: string          // معرف فريد للدفعة
  expiryDate: Date         // تاريخ انتهاء الصلاحية
  quantity: number         // الكمية
  addedDate: Date          // تاريخ الإضافة
}

// عنصر مخزون
export interface InventoryItem {
  productId: string        // معرف المنتج
  productName: string      // اسم المنتج بالعربي
  productNameEn: string    // اسم المنتج بالإنجليزي
  batches: ProductBatch[]  // قائمة الدفعات
  type: InventoryType      // نوع المخزون
  lastUpdated: Date        // آخر تحديث
}

// حساب إجمالي الكمية لعنصر مخزون
export function getTotalQuantity(item: InventoryItem): number {
  return item.batches.reduce((sum, batch) => sum + batch.quantity, 0)
}

// سجل حركة مخزون
export interface InventoryRecord {
  id: string               // معرف فريد
  productId: string
  productName: string
  productNameEn: string
  quantity: number
  batchId?: string
  expiryDate?: Date
  type: InventoryType
  from: string             // "warehouse" | "rep" | customer ID
  to: string               // "warehouse" | "rep" | customer ID
  date: Date
  status?: "pending" | "accepted" | "rejected"
  note?: string
}

// مخزون المندوب
export interface RepInventory {
  repId: string
  repName: string
  items: InventoryItem[]
  records: InventoryRecord[]
}

// مخزون العميل
export interface CustomerInventory {
  customerId: string
  customerName: string
  items: InventoryItem[]
  records: InventoryRecord[]
}
```

### أنواع إضافية مستخدمة في الصفحات (معرّفة inline)

```typescript
// في sales-rep/page.tsx
interface Customer {
  id: string
  name: string
  location: string
  distance: number          // بالكيلومتر
  phone: string
  lastVisit: string         // نص مثل "منذ 3 أيام"
  type: "potential" | "active"
  orders: number
}

// في sales-rep/new-order/page.tsx
interface Product {
  id: string
  name: string
  price: number
  unit: string
  category: string
  image: string
  lastDeliveredQuantity?: number
}

interface CustomerInventory {
  productId: string
  currentStock: number
  lastDeliveredQuantity: number
}

interface OrderItem {
  product: Product
  quantity: number
  batchId: string
}

interface WithdrawItem {
  productId: string
  batchId: string
  quantity: number
  reason: string
  customReason?: string
}
```

---

## 7. نظام إدارة الحالة (State Management - Context)

### `contexts/InventoryContext.tsx`

**هذا هو قلب التطبيق** - يدير كل حالة المخزون باستخدام React Context.

#### Interface
```typescript
interface InventoryContextType {
  repInventory: RepInventory
  customerInventories: Map<string, CustomerInventory>
  
  // إضافة للمخزون
  addToRepInventory: (
    productId: string,
    productName: string,
    productNameEn: string,
    quantity: number,
    type: InventoryType,
    expiryDate?: Date
  ) => void
  
  // إزالة من المخزون
  removeFromRepInventory: (
    productId: string, batchId: string, quantity: number, type: InventoryType
  ) => void
  
  // نقل من المندوب للعميل
  transferToCustomer: (
    customerId: string, customerName: string,
    productId: string, productName: string, productNameEn: string,
    batchId: string, quantity: number
  ) => void
  
  // تحديث مخزون العميل
  updateCustomerInventory: (
    customerId: string, productId: string, batchId: string,
    currentQuantity: number, type: InventoryType
  ) => void
  
  // سحب من العميل
  withdrawFromCustomer: (
    customerId: string, productId: string, batchId: string,
    quantity: number, reason: InventoryType
  ) => void
  
  // قراءة
  getCustomerInventory: (customerId: string) => CustomerInventory | undefined
  getRepInventoryRecords: () => InventoryRecord[]
  getCustomerInventoryRecords: (customerId: string) => InventoryRecord[]
}
```

#### البيانات الأولية (Initial Data)

**مخزون المندوب (repInventory):**
```typescript
repId: "rep-1"
repName: "محمد أحمد"

items: [
  {
    productId: "1", productName: "زيت زيتون فاخر", productNameEn: "Premium Olive Oil",
    type: "active",
    batches: [
      { batchId: "batch-1-1", expiryDate: "2025-12-31", quantity: 30 },
      { batchId: "batch-1-2", expiryDate: "2026-03-15", quantity: 20 },
    ]
  },
  {
    productId: "2", productName: "أرز بسمتي", productNameEn: "Basmati Rice",
    type: "active",
    batches: [
      { batchId: "batch-2-1", expiryDate: "2025-08-20", quantity: 100 },
    ]
  },
  {
    productId: "3", productName: "سكر أبيض", productNameEn: "White Sugar",
    type: "active",
    batches: [
      { batchId: "batch-3-1", expiryDate: "2026-01-10", quantity: 50 },
      { batchId: "batch-3-2", expiryDate: "2025-11-30", quantity: 25 },
    ]
  },
  {
    productId: "4", productName: "شاي أسود", productNameEn: "Black Tea",
    type: "active",
    batches: [
      { batchId: "batch-4-1", expiryDate: "2026-06-30", quantity: 40 },
    ]
  },
]
```

**مخزون العملاء (customerInventories) - Map:**
```
Customer "1" (محمد أحمد التجاري):
  - زيت زيتون فاخر: batch-1-1 → 4 وحدات
  - أرز بسمتي: batch-2-1 → 6 وحدات
  - سكر أبيض: batch-3-1 → 10 وحدات

Customer "2" (سوبر ماركت النور):
  - أرز بسمتي: batch-2-1 → 8 وحدات
  - شاي أسود: batch-4-1 → 0 وحدات (خلص)
```

#### Business Logic في Context

1. **`addToRepInventory`**: يضيف batch جديد أو يزيد الكمية في batch موجود (يقارن بـ expiryDate). إذا كان النوع `return`، يُضاف أيضاً كمخزون `active`.

2. **`removeFromRepInventory`**: ينقص الكمية من batch محدد. يحذف الـ batch إذا وصل لصفر.

3. **`transferToCustomer`**: 
   - ينقص من مخزون المندوب
   - يزيد في مخزون العميل
   - يسجل record في كلا الطرفين

4. **`withdrawFromCustomer`**: 
   - ينقص من مخزون العميل
   - يضيف للمندوب كنوع (return/damaged/expired)
   - يسجل record مع note

5. **كل عملية تسجل `InventoryRecord`** بالـ from/to والتاريخ والنوع

---

## 8. الصفحات والمسارات (Pages & Routes)

| المسار | الملف | الوصف | النوع |
|--------|-------|-------|-------|
| `/` | `app/page.tsx` | الصفحة الرئيسية (Dashboard عام) | Client |
| `/sales-rep` | `app/sales-rep/page.tsx` | Dashboard المندوب | Client |
| `/sales-rep/new-order` | `app/sales-rep/new-order/page.tsx` | طلب جديد (1127 سطر) | Client |
| `/sales-rep/invoice` | `app/sales-rep/invoice/page.tsx` | الفاتورة | Client |
| `/sales-rep/customer-inventory` | `app/sales-rep/customer-inventory/page.tsx` | مخزون العميل | Client |
| `/sales-rep/inventory-records` | `app/sales-rep/inventory-records/page.tsx` | سجل حركات المخزون | Client |

### Query Parameters
| المسار | Parameter | الغرض |
|--------|-----------|-------|
| `/sales-rep/new-order` | `customerId` | معرف العميل |
| `/sales-rep/new-order` | `type` | نوع العميل (`active`/`potential`) |
| `/sales-rep/customer-inventory` | `customerId` | معرف العميل |

---

## 9. مكونات UI المستخدمة (UI Components)

### shadcn/ui Components المستخدمة في sales-rep:
جميعها مثبتة من shadcn/ui بنمط **new-york**:

| Component | Import Path | الاستخدام |
|-----------|-------------|----------|
| `Button` | `@/components/ui/button` | أزرار (primary, outline, ghost) |
| `Card` | `@/components/ui/card` | بطاقات العرض |
| `Badge` | `@/components/ui/badge` | وسوم الحالة |
| `Tabs, TabsList, TabsTrigger, TabsContent` | `@/components/ui/tabs` | تبويبات |
| `Input` | `@/components/ui/input` | حقول إدخال |
| `Label` | `@/components/ui/label` | تسميات |
| `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` | `@/components/ui/select` | قوائم منسدلة |
| `Checkbox` | `@/components/ui/checkbox` | خانات اختيار |
| `Separator` | `@/components/ui/separator` | فواصل |

### Lucide Icons المستخدمة:
```typescript
import { 
  MapPin,           // موقع
  Plus,             // إضافة
  Minus,            // تقليل
  Navigation,       // تحديث الموقع
  Phone,            // هاتف
  Clock,            // وقت
  Home,             // الرئيسية
  Package,          // مخزون
  History,          // سجل
  ArrowLeft,        // سهم يسار
  ArrowRight,       // سهم يمين (رجوع في RTL)
  Calendar,         // تقويم
  ChevronRight,     // سهم التالي
  AlertCircle,      // تنبيه
  XCircle,          // إغلاق/سحب
  User,             // مستخدم
  Check,            // تأكيد
  Percent,          // نسبة مئوية
  DollarSign,       // عملة
  TrendingUp,       // وارد
  TrendingDown,     // صادر
  Users,            // مستخدمين
} from 'lucide-react'
```

### `lib/utils.ts` - Utility Function:
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 10. تفاصيل كل صفحة بالكامل

### 10.1 Root Layout (`app/layout.tsx`)

```
HTML: lang="ar" dir="rtl"
Body: font-sans antialiased
Provider: <InventoryProvider> يلف كل التطبيق
Metadata:
  title: "نظام إدارة المناديب"
  description: "منصة شاملة لإدارة المبيعات الميدانية وتتبع العملاء"
```

### 10.2 Sales Rep Layout (`app/sales-rep/layout.tsx`)

**الغرض**: يعطي شكل الهاتف للتطبيق

**التصميم**:
```
الحاوية الخارجية:
  - min-h-screen
  - bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50
  - flex items-start justify-center
  - py-0 (mobile) | py-8 (desktop)

Phone Container:
  - max-w-[430px] w-full
  - min-h-screen (mobile) | min-h-[calc(100vh-4rem)] (desktop)
  - bg-slate-50
  - shadow-2xl
  - rounded-none (mobile) | rounded-[2.5rem] (desktop)
  - overflow-hidden

Phone Frame (Desktop فقط):
  - إطار خارجي: bg-slate-800 rounded-[3rem] -z-10 (absolute -inset-3)
  - إطار داخلي: bg-slate-700 rounded-[2.75rem] -z-10 (absolute -inset-1)
  - Notch: bg-slate-900 w-28 h-7 rounded-full (absolute top-2 center)
```

### 10.3 Dashboard المندوب (`app/sales-rep/page.tsx`)

**465 سطر - Client Component**

#### التصميم العام:
```
min-h-screen bg-slate-50
```

#### 🔵 القسم 1: Header
```
الشكل: gradient rounded-b-[2rem]
الألوان: from-blue-600 via-blue-700 to-indigo-800
الـ padding: pt-12 pb-8 px-5

المحتوى:
├── السطر العلوي (flex justify-between):
│   ├── يسار: "مرحباً أحمد" + الموقع الحالي (مع أيقونة MapPin)
│   └── يمين: عدد العملاء القريبين (bg-white/15 backdrop-blur-sm rounded-2xl)
│
└── زر "إضافة عميل جديد":
    - w-full bg-white text-blue-700
    - hover:bg-blue-50
    - py-6 rounded-2xl shadow-lg
    - أيقونة Plus
    - يوجه إلى /sales-rep/new-order
```

#### 🔵 القسم 2: Tabs (العملاء / مخزوني)
```
TabsList: grid grid-cols-2, bg-white p-1.5, rounded-2xl, h-14, shadow-sm, border
  ├── "العملاء القريبين" (أيقونة MapPin) 
  └── "مخزوني" (أيقونة Package)

Active Style: bg-blue-600 text-white shadow-md
```

#### 🔵 Tab 1: العملاء القريبين

**Header**: "العملاء القريبين منك" + زر "تحديث الموقع" (ghost, أيقونة Navigation)

**بطاقة كل عميل (Card)**:
```
Card: p-4, bg-white, hover:shadow-lg, border-slate-200, rounded-2xl

المحتوى:
├── الصف العلوي (flex):
│   ├── يمين (flex-1):
│   │   ├── الاسم (font-bold) + Badge الحالة:
│   │   │   - "عميل فعال": bg-emerald-100 text-emerald-700
│   │   │   - "عميل محتمل": bg-blue-100 text-blue-700
│   │   ├── الموقع (مع MapPin icon, text-slate-500)
│   │   └── الهاتف + آخر زيارة (flex-wrap, text-xs)
│   │
│   └── يسار: المسافة
│       - bg-blue-50 rounded-2xl w-14 h-14
│       - الرقم بخط كبير text-blue-600
│       - "كم" بخط صغير
│
└── الأزرار (flex gap-2, border-t):
    ├── "أنا وصلت" (للعميل الفعال) أو "إضافة طلب" (للمحتمل)
    │   - bg-blue-600 hover:bg-blue-700
    │   - يوجه إلى /sales-rep/new-order?customerId=X&type=Y
    │
    └── "المخزون" (للعميل الفعال فقط)
        - variant="outline", أيقونة Package
        - يوجه إلى /sales-rep/customer-inventory?customerId=X
```

**البيانات التجريبية للعملاء**:
```
1. محمد أحمد التجاري - شارع الملك فهد - 0.5 كم - active - 12 طلب
2. سوبر ماركت النور - حي العليا - 1.2 كم - active - 8 طلبات
3. بقالة الفيصلية - شارع التحلية - 2.1 كم - potential - طلبين
```

#### 🔵 Tab 2: مخزوني

**إذا لا يوجد مخزون**:
```
Card فارغة بأيقونة Package كبيرة + "لا يوجد مخزون" + زر العودة
```

**إذا يوجد مخزون**:

**إحصائيات (grid grid-cols-2)**:
```
├── إجمالي المخزون النشط (bg-primary/5 border-primary/30)
│   - أيقونة Package + الرقم الكبير + النص
└── حركة مخزون (bg-blue-50 border-blue-200)
    - أيقونة History + عدد الحركات
```

**عرض المخزون حسب النوع**:
```
أربعة أقسام (كل قسم يظهر فقط إذا فيه بيانات):

1. ✅ المخزون النشط (green):
   - عنوان مع دائرة خضراء
   - كل منتج: Card مع border-green-200 bg-green-50/50
   - يعرض: الاسم + الاسم الإنجليزي + عدد الدفعات
   - داخل كل منتج: قائمة batches مع تاريخ الانتهاء والكمية

2. 🔙 سجل الرجيع (orange):
   - border-orange-200 bg-orange-50/50

3. ❌ المخزون التالف (red):
   - border-red-200 bg-red-50/50

4. ⏰ منتهي الصلاحية (yellow):
   - border-yellow-200 bg-yellow-50/50
```

**زر "عرض سجل حركات المخزون"**: يوجه إلى `/sales-rep/inventory-records`

---

### 10.4 صفحة الطلب الجديد (`app/sales-rep/new-order/page.tsx`)

**1127 سطر - أكبر وأعقد صفحة في التطبيق**

#### ❗ هذه الصفحة لها 3 مراحل (stages) حسب نوع العميل:

```
┌─────────────────────────────────────────────────────────┐
│ عميل جديد (لا يوجد customerId أو غير معروف):            │
│                                                         │
│   Stage 1: "بيانات العميل الجديد" (customer-info)       │
│      ↓                                                  │
│   Stage 2: "هل يريد العميل طلب الآن؟" (wants-order)    │
│      ↓ نعم                    ↓ لا                      │
│   Stage 3: صفحة الطلب        ← حفظ كعميل محتمل         │
│                                والعودة للداشبورد        │
├─────────────────────────────────────────────────────────┤
│ عميل قائم (customerId = "1" أو "2"):                    │
│                                                         │
│   Step 1: "تحديث المخزون" (inventory)                   │
│      ↓                                                  │
│   Step 2: "اختيار المنتجات" (products)                  │
│      ↓                                                  │
│   → الفاتورة                                            │
└─────────────────────────────────────────────────────────┘
```

#### Stage 1: بيانات العميل الجديد

```
Header: gradient أزرق + "بيانات العميل الجديد"
Card مع أيقونة User:
  - اسم العميل * (Input)
  - رقم الجوال * (Input type="tel", dir="ltr", placeholder="05xxxxxxxx")
  - العنوان * (Input) + زر "تحديد تلقائي" (يستخدم navigator.geolocation)
  - الرقم الضريبي (اختياري)

Fixed Bottom Bar:
  - زر "التالي" (disabled حتى الحقول المطلوبة تتعبأ)
  - يحفظ في localStorage بـ key: `customer-${customerId}`
```

#### Stage 2: هل يريد العميل طلب الآن؟

```
Header: gradient أزرق + "رغبة العميل في الطلب"
Card في المنتصف:
  - أيقونة Package كبيرة في دائرة زرقاء
  - "هل يريد العميل طلب الآن؟"
  - زرين:
    1. "نعم، يريد طلب الآن" (emerald-600) → ينقل لصفحة الطلب
    2. "لا، سيطلب لاحقاً" (outline) → يحفظ كعميل محتمل + alert + redirect

ملاحظة أسفل (bg-blue-50):
  "إذا اختار العميل لا، سيتم حفظه كعميل محتمل..."
```

#### Stage 3: صفحة الطلب (Order Stage)

**Header**: sticky, bg-primary, "طلب لعميل قديم" أو "عميل جديد"

**Tabs (2)**:
```
TabsList: grid grid-cols-2, h-14

Tab 1: "يبي ينزّل" (أو "تحديث المخزون" للخطوة الأولى)
  - Active style: bg-primary text-primary-foreground

Tab 2: "لم يتم التنزيل"
  - Active style: bg-destructive text-destructive-foreground
```

#### Tab "يبي ينزّل" - Step: Inventory (للعميل القائم فقط)

**Banner تعليمات**: 
```
Card bg-blue-50 border-blue-200:
  "استخدم + و - لتحديث الكمية المتبقية، أو انقر سحب لسحب منتجات"
```

**لكل منتج في مخزون العميل (Card)**:
```
├── الصورة (w-16 h-16) + الاسم + الوحدة
│
└── لكل batch:
    ├── تاريخ الانتهاء + المتوفر
    │
    ├── الوضع العادي (لا يتم سحبه):
    │   ├── أزرار +/- مع العدد (bg-primary/10 rounded-full)
    │   └── زر "سحب" (border-orange-500, أيقونة XCircle)
    │
    └── وضع السحب (isWithdrawing):
        ├── قائمة اختيار السبب (Select):
        │   - رجيع | تالف | منتهي الصلاحية | قرب انتهاء | مشكلة جودة | منتج خاطئ | أسباب أخرى
        ├── حقل سبب مخصص (إذا "أسباب أخرى")
        ├── أزرار +/- للكمية (bg-orange-200 rounded-full)
        └── زر "إلغاء السحب" (text-red-600)
```

#### Tab "يبي ينزّل" - Step: Products (اختيار المنتجات)

**إذا كان هناك withdrawItems**: يعرض بطاقة "منتجات مسحوبة - هل تريد التبديل؟"
```
لكل منتج مسحوب:
  Checkbox + اسم المنتج + الكمية + Badge السبب
```

**مؤشر حالة المنتج (للعميل القائم)**:
```
├── 🟡 "منتجات خلصت" (bg-yellow-50 border-yellow-300)
└── 🔵 "منتجات جديدة" (bg-blue-50 border-blue-200)
```

**لكل منتج في مخزون المندوب النشط (Card)**:
```
Card مع border حسب الحالة:
  - empty → border-yellow-400 bg-yellow-50/50 + Badge "خلص"
  - new → border-blue-300 bg-blue-50/50 + Badge "جديد"
  - normal → border-border

├── الصورة (w-20 h-20) + الاسم + الوحدة + الفئة + السعر
├── Badge "المحدد: X" (إذا تم اختيار كمية)
│
└── لكل batch:
    ├── تاريخ الانتهاء + المتوفر
    ├── إذا لم يُختر:
    │   └── زر "إضافة" (bg-primary, أيقونة Plus)
    └── إذا اختير:
        └── أزرار +/- مع العدد (bg-primary/10 rounded-full)
```

#### Tab "لم يتم التنزيل" (No Order)

```
Card مع عنوان "اختر سبب عدم التنزيل:"
  6 أسباب (Checkbox لكل سبب):
    1. عنده متطلب من المخزون
    2. يحتاج شهادة ضريبية
    3. يريد تأجيل الدفع
    4. لا يوجد ميزانية حالياً
    5. يتعامل مع منافس
    6. سبب آخر

Style: data-[state=checked]:bg-destructive
```

#### Fixed Bottom Bar
```
├── يسار: عرض الإحصائيات
│   - إذا order: "إجمالي المنتجات" + العدد (text-2xl text-primary)
│   - إذا no-order: "الأسباب المحددة" + العدد (text-destructive)
│
└── يمين: زر الإجراء
    - إذا order + inventory step: "التالي"
    - إذا order + products step: "إنهاء الطلب" → يحفظ في sessionStorage ويوجه للفاتورة
    - إذا no-order: "تسجيل" → alert + redirect
```

#### المنتجات المتاحة (Static Data)
```typescript
const PRODUCTS = [
  { id: "1", name: "زيت زيتون فاخر",  price: 45.0,  unit: "لتر",              category: "زيوت",    image: "/olive-oil-bottle.png",    lastDeliveredQuantity: 4 },
  { id: "2", name: "أرز بسمتي",       price: 35.0,  unit: "كيس 5 كجم",        category: "حبوب",    image: "/rice-bag.png",            lastDeliveredQuantity: 6 },
  { id: "3", name: "سكر أبيض",        price: 12.0,  unit: "كيس 2 كجم",        category: "سكريات",  image: "/sugar-bag.jpg",           lastDeliveredQuantity: 10 },
  { id: "4", name: "شاي أسود",        price: 28.0,  unit: "علبة 400 جرام",    category: "مشروبات", image: "/tea-box.jpg",             lastDeliveredQuantity: 0 },
  { id: "5", name: "معكرونة",         price: 8.5,   unit: "كرتون 12 كيس",     category: "معجنات",  image: "/pasta-box.png",           lastDeliveredQuantity: 3 },
  { id: "6", name: "صلصة طماطم",      price: 15.0,  unit: "كرتون 24 علبة",    category: "معلبات",  image: "/rich-tomato-sauce.png",   lastDeliveredQuantity: 0 },
]
```

#### أسباب السحب (Withdraw Reasons)
```typescript
const WITHDRAW_REASONS = [
  { id: "return",        label: "رجيع" },
  { id: "damaged",       label: "تالف" },
  { id: "expired",       label: "منتهي الصلاحية" },
  { id: "near-expiry",   label: "قرب انتهاء الصلاحية" },
  { id: "quality-issue", label: "مشكلة في الجودة" },
  { id: "wrong-product", label: "منتج خاطئ" },
  { id: "other",         label: "أسباب أخرى" },
]
```

#### أسباب عدم التنزيل (Rejection Reasons)
```typescript
const REJECTION_REASONS = [
  { id: "stock",       label: "عنده متطلب من المخزون" },
  { id: "certificate", label: "يحتاج شهادة ضريبية" },
  { id: "payment",     label: "يريد تأجيل الدفع" },
  { id: "budget",      label: "لا يوجد ميزانية حالياً" },
  { id: "competition", label: "يتعامل مع منافس" },
  { id: "other",       label: "سبب آخر" },
]
```

---

### 10.5 صفحة الفاتورة (`app/sales-rep/invoice/page.tsx`)

#### كيف تحصل على البيانات:
```typescript
// تقرأ من sessionStorage (تم حفظها من new-order)
const orderItems = JSON.parse(sessionStorage.getItem("orderItems"))
const withdrawItems = JSON.parse(sessionStorage.getItem("withdrawItems"))
const replacementItems = JSON.parse(sessionStorage.getItem("replacementItems"))
```

#### التصميم:

**Header**: sticky, bg-primary, "الفاتورة", زر رجوع إلى `/sales-rep/new-order`

**القسم 1: المنتجات المسحوبة (إن وجدت)**
```
Card: border-2 border-orange-300 bg-orange-50
├── أيقونة AlertCircle + عنوان + وصف
│
├── لكل منتج مسحوب:
│   └── div bg-white rounded-xl:
│       ├── الصورة (w-12 h-12) + الاسم + الكمية × السعر
│       ├── Badge السبب
│       ├── القيمة بالسالب (-X ر.س) باللون البرتقالي
│       └── Badge "سيتم التبديل" (إذا replacement)
│
└── إجمالي المسحوبات
```

**القسم 2: عناصر الطلب (لكل منتج Card)**
```
Card: border-2
├── الصورة (w-16 h-16) + الاسم + "X × السعر"
├── المجموع الفرعي
│
├── Separator
│
└── قسم الخصم (اختياري):
    ├── Select: "مبلغ ثابت" (DollarSign) أو "نسبة مئوية" (Percent)
    ├── Input: قيمة الخصم
    ├── عرض قيمة الخصم (bg-primary/10)
    └── المجموع بعد الخصم (bg-primary/20)
```

**القسم 3: ملخص الفاتورة**
```
Card: border-2 border-primary/30 bg-primary/5
├── المجموع الفرعي
├── إجمالي الخصم (إن وجد)
├── الضريبة (15% VAT)
├── إجمالي الطلبات الجديدة (text-primary)
├── إجمالي المسحوبات (text-orange-600, إن وجد)
├── Separator
└── الباقي للعميل (text-2xl font-bold)
    - أخضر/أزرق إذا موجب
    - برتقالي إذا سالب + رسالة "سيتم خصم المبلغ من رصيد العميل"
```

**Bottom Bar**: زر "تأكيد الطلب" (أيقونة Check)
```
- يعرض alert("تم إرسال الطلب بنجاح!")
- يمسح sessionStorage
- يوجه إلى /sales-rep
```

#### حسابات الفاتورة:
```
الخصم لكل منتج:
  - ثابت: subtotal - discount.value
  - نسبة: subtotal × (1 - discount.value / 100)

المجموع الفرعي = مجموع (سعر × كمية) لكل منتج
إجمالي الخصم = مجموع (subtotal - itemTotal)
المجموع بعد الخصم = مجموع calculateItemTotal()
الضريبة = المجموع × 0.15
الإجمالي = المجموع + الضريبة
المسحوبات = مجموع (سعر × كمية) للمسحوبات غير المُبدّلة
الباقي = الإجمالي - المسحوبات
```

---

### 10.6 مخزون العميل (`app/sales-rep/customer-inventory/page.tsx`)

#### التصميم:
```
Header: sticky, bg-primary, "مخزون العميل", زر رجوع

Card إحصائيات:
  - اسم العميل (text-xl)
  - عدد المنتجات (أيقونة Package)
  - عدد الحركات (أيقونة History)

قسم "المخزون الحالي":
  لكل منتج Card:
    ├── الاسم + آخر تحديث
    └── الكمية (text-2xl text-primary) + Badge النوع

قسم "آخر الحركات" (آخر 5):
  لكل حركة Card bg-muted/50:
    ├── اسم المنتج + التاريخ (Badge)
    └── "من: المندوب" + الكمية (+X بالأخضر)
```

**ملاحظة**: هذه الصفحة ملفوفة بـ `<Suspense>` مع Loading مخصص

---

### 10.7 سجل حركات المخزون (`app/sales-rep/inventory-records/page.tsx`)

#### التصميم:
```
Header: sticky, bg-primary, "سجل حركات المخزون", زر رجوع

Card إحصائيات:
  - "إجمالي الحركات" + العدد (text-3xl)

لكل حركة (Card):
  ├── أيقونة الاتجاه:
  │   - وارد (TrendingUp): bg-green-100 text-green-600
  │   - صادر (TrendingDown): bg-red-100 text-red-600
  │
  ├── اسم المنتج + Badge (وارد/صادر)
  │   - وارد: bg-green-600
  │   - صادر: bg-red-600
  │
  ├── من/إلى + الكمية:
  │   - وارد: +X بالأخضر
  │   - صادر: -X بالأحمر
  │
  └── التاريخ + Badge النوع:
      - نشط | رجيع | تالف | إكسباير

إذا لا يوجد حركات: أيقونة Package كبيرة + "لا توجد حركات"
```

---

## 11. منطق الأعمال (Business Logic)

### 11.1 تدفق العمل الكامل للمندوب

```
┌─ الدخول على Dashboard ─────────────────────────────────┐
│                                                          │
│  ┌── عرض العملاء القريبين ───┐  ┌── عرض مخزوني ──────┐ │
│  │  (Tab: العملاء القريبين)    │  │  (Tab: مخزوني)      │ │
│  │                             │  │                      │ │
│  │  لكل عميل:                 │  │  نشط / رجيع /       │ │
│  │  ├── "أنا وصلت" (فعال)     │  │  تالف / منتهي       │ │
│  │  ├── "إضافة طلب" (محتمل)   │  │                      │ │
│  │  └── "المخزون" (فعال)      │  │  → سجل الحركات      │ │
│  └──────────────┬──────────────┘  └──────────────────────┘ │
│                 │                                          │
│                 ▼                                          │
│  ┌── صفحة الطلب الجديد ─────────────────────────────────┐│
│  │                                                        ││
│  │  عميل جديد:                                           ││
│  │  ├── إدخال البيانات → هل يريد طلب؟ → إنشاء طلب      ││
│  │  └── أو حفظ كعميل محتمل                               ││
│  │                                                        ││
│  │  عميل قائم:                                           ││
│  │  ├── Step 1: تحديث مخزون العميل + سحب                ││
│  │  └── Step 2: اختيار منتجات جديدة من مخزون المندوب    ││
│  │                                                        ││
│  │  أو: تسجيل أسباب عدم التنزيل                          ││
│  └──────────────┬────────────────────────────────────────┘│
│                 │                                          │
│                 ▼                                          │
│  ┌── صفحة الفاتورة ─────────────────────────────────────┐│
│  │  - المنتجات المسحوبة (إن وجدت)                        ││
│  │  - عناصر الطلب + الخصومات                             ││
│  │  - ملخص: فرعي + خصم + ضريبة 15% + مسحوبات = الباقي  ││
│  │  - تأكيد الطلب                                        ││
│  └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 11.2 نظام المخزون بالـ Batches

```
المنتج (Product)
  └── عدة دفعات (Batches)
      └── كل دفعة لها:
          - batchId: معرف فريد
          - expiryDate: تاريخ انتهاء
          - quantity: الكمية
          - addedDate: تاريخ الإضافة

عند البيع: يختار المندوب من أي batch
عند السحب: يحدد من أي batch يسحب
```

### 11.3 حفظ البيانات بين الصفحات

| المخزن | المفتاح | الغرض |
|--------|---------|-------|
| `sessionStorage` | `orderItems` | عناصر الطلب المحددة → الفاتورة |
| `sessionStorage` | `customerInventory` | مخزون العميل المحدث → الفاتورة |
| `sessionStorage` | `withdrawItems` | المنتجات المسحوبة → الفاتورة |
| `sessionStorage` | `replacementItems` | المنتجات المراد تبديلها → الفاتورة |
| `localStorage` | `customer-${id}` | بيانات العميل الجديد المحفوظة |

### 11.4 تحديد حالة المنتج عند العميل

```typescript
function getProductStatus(productId): "empty" | "new" | "normal" {
  const stock = getInventoryStock(productId)     // الكمية الحالية
  const lastDelivered = getLastDeliveredQuantity(productId)  // آخر كمية تم تسليمها

  if (stock === 0 && lastDelivered > 0) return "empty"  // خلص
  if (lastDelivered === 0) return "new"                   // منتج جديد (لم يُسلّم قبل)
  return "normal"
}
```

### 11.5 mapping سبب السحب لنوع المخزون

```typescript
const inventoryType: InventoryType = 
  reason === "return" ? "return" :
  reason === "damaged" ? "damaged" :
  (reason === "expired" || reason === "near-expiry") ? "expired" :
  "damaged"  // default
```

---

## 12. الصور والأصول (Public Assets)

جميع الصور في `/public/`:

| الملف | الاستخدام |
|-------|----------|
| `olive-oil-bottle.png` | صورة زيت زيتون فاخر |
| `rice-bag.png` | صورة أرز بسمتي |
| `sugar-bag.jpg` | صورة سكر أبيض |
| `tea-box.jpg` | صورة شاي أسود |
| `pasta-box.png` | صورة معكرونة |
| `rich-tomato-sauce.png` | صورة صلصة طماطم |
| `placeholder.svg` | صورة بديلة إذا لم تتوفر الصورة |

**ملاحظة**: الصور تُعرض بحجم محدد ضمن `<img>` عادي (ليس Next.js Image)، مع `object-cover` و `rounded-lg/xl`.

---

## 13. CSS Animations

### Custom Animations في `app/globals.css`:
```css
/* ظهور من الأسفل */
@keyframes slideUpIn {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ظهور من الأعلى */
@keyframes slideDownIn {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ظهور حقل الإدخال */
@keyframes inputFade {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* نبض بطيء */
@keyframes pulseSlow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.5; }
}

/* شريط التحميل */
@keyframes loadingBar {
  0% { width: 0%; }
  100% { width: 100%; }
}

/* ظهور بنطاطة */
@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { opacity: 1; transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
}

/* CSS Classes */
.animate-slide-up-in    { animation: slideUpIn 0.5s ease-out; }
.animate-slide-down-in  { animation: slideDownIn 0.5s ease-out; }
.animate-input-fade     { animation: inputFade 0.4s ease-out backwards; }
.animate-pulse-slow     { animation: pulseSlow 4s ease-in-out infinite; }
.animate-loading-bar    { animation: loadingBar 10s ease-out forwards; }
.animate-bounce-in      { animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
```

### Loading States المستخدمة:
```
1. Spinner: w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin
2. Skeleton: animate-pulse على أيقونة Package
3. Full Page: flex items-center justify-center min-h-screen
```

---

## 14. دليل التشغيل والنشر

### التثبيت والتشغيل المحلي
```bash
# 1. إنشاء المشروع
npx create-next-app@latest sales-rep-app --typescript --tailwind --app --src-dir=false

# 2. تثبيت التبعيات
cd sales-rep-app
pnpm install    # أو npm install

# 3. تثبيت shadcn/ui
npx shadcn@latest init
# اختر: style=new-york, baseColor=neutral, cssVariables=true

# 4. إضافة مكونات shadcn/ui المطلوبة
npx shadcn@latest add button card badge tabs input label select checkbox separator

# 5. تشغيل التطوير
pnpm dev
```

### أوامر البناء
```bash
pnpm dev        # Development server
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # Run linter
```

### ملاحظات مهمة للربط مع Backend:
1. **حالياً البيانات Static/Mock** - جميع البيانات في Context و const arrays
2. **للربط مع Frappe/ERPNext API**:
   - استبدل `useState` بـ API calls (fetch/axios)
   - استبدل `localStorage/sessionStorage` بـ API state
   - استبدل `PRODUCTS` array بـ API endpoint `/api/resource/Item`
   - استبدل العملاء بـ `/api/resource/Customer`
   - استبدل المخزون بـ `/api/resource/Stock Entry`
   - استبدل الطلبات بـ `/api/resource/Sales Order`
   - استبدل الفاتورة بـ `/api/resource/Sales Invoice`

3. **نقاط API المقترحة**:
   ```
   GET  /api/method/get_nearby_customers?lat=X&lng=Y
   GET  /api/method/get_rep_inventory?rep_id=X
   GET  /api/method/get_customer_inventory?customer_id=X
   POST /api/method/create_sales_order
   POST /api/method/create_stock_entry (for withdrawals)
   POST /api/method/create_sales_invoice
   ```

---

## 📎 ملحق: خريطة الملفات المطلوبة للإعادة بناء sales-rep فقط

إذا كنت تريد بناء قسم `/sales-rep` فقط كتطبيق مستقل:

```
المطلوب:
├── app/
│   ├── globals.css
│   ├── layout.tsx (مع InventoryProvider)
│   └── sales-rep/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── new-order/page.tsx + loading.tsx
│       ├── invoice/page.tsx
│       ├── customer-inventory/page.tsx + loading.tsx
│       └── inventory-records/page.tsx
├── contexts/InventoryContext.tsx
├── types/inventory.ts
├── lib/utils.ts
├── components/ui/ (shadcn components)
├── public/ (صور المنتجات)
└── Config files
```

---

> **آخر تحديث**: فبراير 2026
> **حجم الكود الكلي لقسم sales-rep**: ~3,500 سطر (بدون مكونات UI)
> **التطبيق جاهز بالفعل في**: `/home/frappeuser/frappe-dev/crm-micro-4/`
