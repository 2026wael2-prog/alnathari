# دليل تشغيل منظومة (Evolution API + Chatwoot + الزهراء ERP) 🚀

يوفر هذا الدليل خطوات الربط المؤسسي الثلاثي بين:
1. **Evolution API**: خادم واتساب مستقل وخفيف، يدعم مسح QR Code وتعدد الأرقام ومستقر 24/7.
2. **Chatwoot**: منصة خدمة العملاء وصندوق الوارد الجماعي لموظفي المبيعات والمحاسبين.
3. **الزهراء ERP**: العقل المالي والذكاء الاصطناعي لإصدار الفواتير، متابعة الديون، وعرض بيانات العميل الحية في شريط Chatwoot الجانبي.

---

## 1. متطلبات التشغيل
* خادم VPS (مثل Hetzner, Contabo, DigitalOcean) يعمل بنظام Ubuntu 22.04 أو 24.04 (أو تشغيله محلياً عبر Docker Desktop).
* تثبيت Docker و Docker Compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```

---

## 2. خطوات التشغيل السريع (في 3 دقائق)

1. انسخ مجلد `deploy/chatwoot-evolution-stack` إلى خادمك.
2. أنشئ ملف المتغيرات `.env`:
   ```bash
   cp .env.example .env
   ```
   *(قم بتعديل كلمات المرور وروابط النطاق داخل ملف `.env`)*.

3. تهيئة قاعدة بيانات Chatwoot للمرة الأولى:
   ```bash
   docker compose run --rm chatwoot-web bundle exec rails db:chatwoot_prepare
   ```

4. تشغيل جميع الخدمات في الخلفية:
   ```bash
   docker compose up -d
   ```

---

## 3. ربط رقم الواتساب عبر Evolution API
1. افتح واجهة Evolution API أو استخدم أداة Postman / Curl لإنشاء الجلسة باسم `alzhra`:
   ```bash
   curl -X POST http://YOUR_SERVER_IP:8080/instance/create \
     -H "Content-Type: application/json" \
     -H "apikey: YOUR_EVOLUTION_API_KEY" \
     -d '{
       "instanceName": "alzhra",
       "token": "alzhra_token",
       "qrcode": true,
       "integration": "CHATWOOT",
       "chatwoot_account_id": "1",
       "chatwoot_token": "YOUR_CHATWOOT_USER_TOKEN",
       "chatwoot_url": "http://chatwoot-web:3000"
     }'
   ```
2. امسح رمز الاستجابة السريعة (QR Code) بكاميرا الواتساب على هاتفك.
3. مبروك! أصبح رقم الواتساب متصلاً فورياً مع Chatwoot ومع نظام الزهراء.

---

## 4. إضافة ودجت الزهراء داخل Chatwoot (Dashboard App)
لتمكين الموظفين من رؤية أرصدة وفواتير العميل أثناء التحدث معه:
1. داخل لوحة تحكم **Chatwoot**:
   - توجه إلى: **Settings** ⬅️ **Applications** ⬅️ **Dashboard Apps** ⬅️ **Add New Dashboard App**.
2. عبئ الحقول كالتالي:
   - **App Name**: `الزهراء ERP`
   - **App URL**:
     ```text
     https://YOUR_ERP_DOMAIN/#/chatwoot-widget
     ```
3. احفظ الإعدادات. الآن بمجرد فتح أي محادثة عميل، سيظهر في الشريط الجانبي الأيمن:
   - رصيد العميل بالريال اليمني والسعودي.
   - كليشة جاهزة بنقرة واحدة لنسخ الرصيد وإرساله.
   - آخر الفواتير وسندات القبض.
   - تسجيل وعد سداد فوري بالمنظومة بنقرة زر!

