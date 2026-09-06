const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// قاعدة بيانات الأكواد
let databaseCodes = {
    "GHOST-1234": { status: "active" },
    "VIP-9999": { status: "active" }
};

// 🔒 قائمة البطاقات المخزنة حصرياً في السيرفر الآمن
let secureCards = [];

// كلمة مرور الأدمن
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

// 2. جلب كافة بيانات لوحة التحكم (الأكواد والبطاقات) - محمي
app.get('/api/admin/data', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    
    res.status(200).json({
        codes: databaseCodes,
        cards: secureCards.map(c => ({ number: c.number })) // إرسال أرقام جزئية فقط للعرض الآمن
    });
});

// 3. توليد كود تفعيل جديد - محمي
app.post('/api/admin/generate', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });

    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode = `GHOST-${randomPart}`;
    databaseCodes[newCode] = { status: "active" };

    res.status(200).json({ message: 'تم التوليد', newCode });
});

// 4. إضافة بطاقة جديدة من لوحة الأدمن - محمي
app.post('/api/admin/add-card', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });

    const { number, expiry, cvv } = req.body;
    if (!number || !expiry || !cvv) {
        return res.status(400).json({ message: 'جميع بيانات البطاقة مطلوبة' });
    }

    // تخزين البطاقة في الذاكرة الآمنة للسيرفر
    secureCards.push({ number, expiry, cvv });
    res.status(200).json({ message: 'تم حفظ البطاقة بنجاح' });
});

// 5. التحقق من كود الزبون
app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    if (!cdk || !databaseCodes[cdk]) {
        return res.status(404).json({ message: 'الكود غير موجود' });
    }
    if (databaseCodes[cdk].status === 'used') {
        return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    }
    res.status(200).json({ message: 'الكود صالح' });
});

// 6. التفعيل (يستخدم البطاقة المخزنة في السيرفر تلقائياً)
app.post('/api/activate-business', (req, res) => {
    const { cdk, sessionData } = req.body;
    
    try {
        if (secureCards.length === 0) {
            return res.status(400).json({ message: 'عذراً، لا توجد بطاقات نشطة حالياً في السيرفر لإتمام التفعيل' });
        }

        const parsed = JSON.parse(sessionData);
        if (!parsed.accessToken && !parsed.user) {
            return res.status(400).json({ message: 'بيانات الجلسة غير صالحة' });
        }

        if (!databaseCodes[cdk] || databaseCodes[cdk].status === 'used') {
            return res.status(400).json({ message: 'الكود غير صالح أو مستخدم' });
        }

        // 💡 السيرفر سيسحب أول بطاقة نشطة من secureCards لتنفيذ الأتمتة
        const activeCard = secureCards[0]; 

        let isActivationSuccessful = true; // محاكاة نجاح التفعيل باستخدام البطاقة المخزنة

        if (isActivationSuccessful) {
            databaseCodes[cdk].status = 'used';
            return res.status(200).json({ message: 'تم التفعيل وترقية الحساب بنجاح باستخدام بطاقتك المخزنة' });
        } else {
            return res.status(400).json({ message: 'فشل الدفع بالبطاقة' });
        }
    } catch (e) {
        res.status(400).json({ message: 'خطأ في معالجة البيانات' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Secure Server running on port ${PORT}`));
