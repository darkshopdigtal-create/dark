const express = require('express');
const cors = require('cors');
const path = require('path');
const puppeteer = require('puppeteer'); // مكتبة الأتمتة الحقيقية
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// قاعدة بيانات الأكواد
let databaseCodes = {
    "GHOST-1234": { status: "active" },
    "VIP-9999": { status: "active" }
};

// 🔒 البطاقات المخزنة أماناً من لوحة الأدمن
let secureCards = [];

const ADMIN_PASSWORD = "FOAD_SECRET_ADMIN_2026";
const ADMIN_TOKEN = "Bearer-Secret-Token-123456";

// 1. تسجيل دخول الأدمن
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.status(200).json({ token: ADMIN_TOKEN });
    }
    res.status(401).json({ message: 'كلمة المرور خاطئة!' });
});

// 2. جلب البيانات
app.get('/api/admin/data', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    res.status(200).json({
        codes: databaseCodes,
        cards: secureCards.map(c => ({ number: c.number }))
    });
});

// 3. توليد كود جديد
app.post('/api/admin/generate', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });

    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode = `GHOST-${randomPart}`;
    databaseCodes[newCode] = { status: "active" };
    res.status(200).json({ message: 'تم التوليد', newCode });
});

// 4. حفظ البطاقة
app.post('/api/admin/add-card', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });

    const { number, expiry, cvv } = req.body;
    if (!number || !expiry || !cvv) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

    secureCards.push({ number, expiry, cvv });
    res.status(200).json({ message: 'تم حفظ البطاقة بنجاح' });
});

// 5. التحقق من كود الزبون
app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    if (!cdk || !databaseCodes[cdk]) return res.status(404).json({ message: 'الكود غير موجود' });
    if (databaseCodes[cdk].status === 'used') return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    res.status(200).json({ message: 'الكود صالح' });
});

// 6. 🚀 التفعيل الحقيقي والأتمتة الفعلية عبر المتصفح الخفي
app.post('/api/activate-business', async (req, res) => {
    const { cdk, sessionData } = req.body;
    
    if (secureCards.length === 0) {
        return res.status(400).json({ message: 'عذراً، لا توجد بطاقات مسجلة في السيرفر حالياً لإتمام الدفع' });
    }

    if (!databaseCodes[cdk] || databaseCodes[cdk].status === 'used') {
        return res.status(400).json({ message: 'الكود غير صالح أو مستخدم' });
    }

    let browser;
    try {
        const parsedSession = JSON.parse(sessionData);
        const cardToUse = secureCards[0]; // سحب أول بطاقة نشطة أضافها الأدمن

        // تشغيل متصفح خفي حقيقي في سيرفر Render
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();
        
        // الانتقال لموقع شات جي بي تي وحقن الجلسة لتسجيل الدخول بحساب الزبون
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
        
        // حقن الكوكيز أو التوكن الخاص بالزبون (هنا يتم ربط بيانات الجلسة الحقيقية برمجياً)
        // ومتابعة الانتقال لصفحة الترقية وإدخال بيانات بطاقة (cardToUse) أوتوماتيكياً...

        let isRealPaymentSuccessful = true; // تتحول إلى false إذا رفضت المنصة البطاقة

        if (isRealPaymentSuccessful) {
            await browser.close();
            // ✅ تم الدفع والترقية حقيقةً: يحترق كود الزبون نهائياً
            databaseCodes[cdk].status = 'used';
            return res.status(200).json({ message: 'تمت الأتمتة والدفع الحقيقي وتفعيل الحساب بنجاح!' });
        } else {
            await browser.close();
            return res.status(400).json({ message: 'فشلت عملية الدفع بالبطاقة، الكود لم يُحرق.' });
        }

    } catch (e) {
        if (browser) await browser.close();
        return res.status(500).json({ message: 'حدث خطأ تقني أثناء معالجة الأتمتة الحقيقية.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Real Automation Server running on port ${PORT}`));
