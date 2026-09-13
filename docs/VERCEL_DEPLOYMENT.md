# 🚀 نشر نظام Meena HR على Vercel

## خطوات النشر السريعة

### 1️⃣ تجهيز المشروع

```bash
cd hr-management-system-ui
npm install
npm run build  # اختبار البناء محلياً
```

### 2️⃣ إعداد Vercel CLI (اختياري)

```bash
npm install -g vercel
vercel login
```

### 3️⃣ النشر عبر GitHub (الطريقة الموصى بها)

#### الخطوة 1: Push الكود على GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin master
```w;dmqw;md;lqwdm;l2dm

#### الخطوة 2: ربط Vercel بـ GitHub
1. اذهب إلى https://vercel.com
2. سجل دخول بحساب GitHub
3. اضغط "Add New Project"
4. اختر repository: `base-meena-frontend`
5. اضغط "Import"

#### الخطوة 3: إعداد Environment Variables
في صفحة المشروع على Vercel، اذهب إلى **Settings → Environment Variables** وأضف:

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_FRAPPE_URL` | `https://your-frappe-backend.com` | Production |
| `NEXT_PUBLIC_APP_NAME` | `Meena HR System` | All |
| `NODE_ENV` | `production` | Production |

**⚠️ مهم جداً:** استبدل `https://your-frappe-backend.com` برابط Frappe Backend الحقيقي!

#### الخطوة 4: Deploy
- اضغط "Deploy"
- انتظر 2-3 دقائق
- ✅ المشروع جاهز!

---

### 4️⃣ النشر عبر Vercel CLI

```bash
cd hr-management-system-ui
vercel --prod
```

ستحتاج للإجابة على الأسئلة:
- **Set up and deploy?** → Yes
- **Which scope?** → اختر حسابك
- **Link to existing project?** → No
- **Project name?** → meena-hr-system
- **Directory?** → ./
- **Override settings?** → No

---

## 🔧 تكوين Frappe Backend

### إعدادات CORS على Frappe
يجب تفعيل CORS على Frappe Backend لقبول طلبات من Vercel:

```python
# في ملف site_config.json على Frappe
{
  "allow_cors": "*",
  "cors_origin": [
    "https://your-vercel-app.vercel.app",
    "http://localhost:3000"
  ],
  "ignore_csrf": 1
}
```

أو عبر Terminal:
```bash
cd ~/frappe-bench
bench set-config allow_cors "*" -g
bench restart
```

---

## 🌐 Vercel URLs

بعد النشر، ستحصل على:

- **Production URL:** `https://meena-hr-system.vercel.app`
- **Preview URLs:** لكل commit جديد
- **Custom Domain:** يمكن ربط domain خاص (Settings → Domains)

---

## 🔄 التحديثات التلقائية

Vercel يقوم بـ deploy تلقائي عند:
- ✅ Push على branch `master` → Production deployment
- ✅ Push على branches أخرى → Preview deployment
- ✅ Pull Request جديد → Preview deployment

---

## 📊 مراقبة الأداء

في لوحة Vercel Dashboard:
- **Analytics** - عدد الزوار والأداء
- **Logs** - سجلات الأخطاء
- **Speed Insights** - تحليل السرعة
- **Web Vitals** - مقاييس الأداء

---

## 🛠️ إعدادات متقدمة

### تخصيص Build Command
في `package.json`:
```json
{
  "scripts": {
    "build": "next build",
    "vercel-build": "npm run build"
  }
}
```

### Redirects & Rewrites
تم تكوينها في `vercel.json` لإعادة توجيه `/api/*` إلى Frappe Backend.

### Environment Variables للـ Development
أنشئ ملف `.env.local` (لا يُرفع على Git):
```env
NEXT_PUBLIC_FRAPPE_URL=http://localhost:8000
```

---

## 🐛 حل المشاكل الشائعة

### مشكلة: Build fails
```bash
# تأكد من:
npm run build  # يعمل محلياً
npm run lint   # لا توجد أخطاء
```

### مشكلة: API calls تفشل
- ✅ تأكد من `NEXT_PUBLIC_FRAPPE_URL` صحيح
- ✅ تأكد من CORS مفعّل على Frappe
- ✅ افحص Network tab في Developer Tools

### مشكلة: Images لا تظهر
- ✅ تأكد من `unoptimized: true` في `next.config.mjs`
- ✅ أضف Frappe domain في `remotePatterns`

### مشكلة: Environment Variables لا تعمل
- ✅ يجب أن تبدأ بـ `NEXT_PUBLIC_` للوصول من المتصفح
- ✅ أعد deploy بعد تغيير المتغيرات
- ✅ تأكد من Environment هو "Production"

---

## 📱 اختبار الـ Deployment

بعد النشر، اختبر:

1. **الصفحة الرئيسية:** https://your-app.vercel.app
2. **تسجيل الدخول:** يجب الاتصال بـ Frappe
3. **Dashboard:** بيانات الموظفين تظهر
4. **API Calls:** افحص Network tab
5. **Mobile View:** اختبر على الهاتف

---

## 🔐 الأمان

### Recommended Settings:
```javascript
// في next.config.mjs
headers: [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
]
```

---

## 💰 التكلفة

### Vercel Free Tier:
- ✅ 100 GB Bandwidth/month
- ✅ Unlimited projects
- ✅ Automatic HTTPS
- ✅ Preview deployments
- ✅ Analytics (basic)

### Pro Plan ($20/month):
- ✅ 1 TB Bandwidth
- ✅ Advanced analytics
- ✅ Password protection
- ✅ Team collaboration

---

## 📞 الدعم

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Vercel Support:** https://vercel.com/support

---

## ✅ Checklist قبل النشر

- [ ] `npm run build` يعمل بدون أخطاء
- [ ] `.env.example` تم إنشاؤه
- [ ] `vercel.json` تم تكوينه
- [ ] Frappe Backend URL جاهز
- [ ] CORS مفعّل على Frappe
- [ ] GitHub repo محدث
- [ ] Environment Variables محددة على Vercel
- [ ] Domain name جاهز (اختياري)

---

## 🎉 النتيجة النهائية

بعد اتباع الخطوات، ستحصل على:

✅ نظام HR يعمل 24/7  
✅ HTTPS مجاني  
✅ CDN عالمي سريع  
✅ Auto-scaling  
✅ Zero downtime deployments  
✅ Preview URLs لكل تحديث  

**المشروع جاهز للإنتاج! 🚀**
