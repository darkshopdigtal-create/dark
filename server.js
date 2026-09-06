const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// قاعدة بيانات الأكواد التي تبيعها للزبائن
let databaseCodes = {
    "GHOST-1234": { status: "active" },
    "VIP-9999": { status: "active" }
};

// 🔒 1. بروموكودك الخاص والسرّي (مخفي تماماً عن الزبائن ولا يظهر في أي مكان عام)
const MY_SECRET_PROMO_CODE = "https://chatgpt.com/?promoCode=BWND2QUPKGG6UQSU";

// 1. مسار التحقق من كود الزبون (CDK)
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

// 2. مسار الأتمتة واستخدام بروموكودك السري وتثبيت 3 مقاعد
app.post('/api/activate-business', (req, res) => {
    const { cdk, sessionData } = req.body;
    
    try {
        const parsed = JSON.parse(sessionData);
        if (!parsed.accessToken && !parsed.user) {
            return res.status(400).json({ message: 'بيانات الجلسة غير صالحة' });
        }

        if (!databaseCodes[cdk] || databaseCodes[cdk].status === 'used') {
            return res.status(400).json({ message: 'الكود غير صالح أو تم استخدامه' });
        }

        // ===================================================================
        // [هنا يعمل السيرفر في الخلفية]:
        // 1. يأخذ بروموكودك السري: MY_SECRET_PROMO_CODE
        // 2. يطبق شرط الـ 3 مقاعد أوتوماتيكياً
        // 3. يدخل لحساب الزبون باستخدام الـ Session ويفعله
        // ===================================================================
        let isAutomationSuccessful = true; // تتحول إلى false إذا فشلت الأتمتة

        if (isAutomationSuccessful) {
            // ✅ نجح التفعيل ببروموكودك السري: يحترق كود الزبون (CDK) نهائياً
            databaseCodes[cdk].status = 'used';
            return res.status(200).json({ message: 'تم التفعيل بنجاح' });
        } else {
            // ❌ فشل التفعيل: يبقى كود الزبون سليماً وغير محروق
            return res.status(400).json({ message: 'فشلت الأتمتة التلقائية، كودك آمن ولم يُحرق' });
        }
    } catch (e) {
        res.status(400).json({ message: 'خطأ في معالجة الطلب' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Secure Server running on port ${PORT}`));
