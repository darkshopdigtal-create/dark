const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());

// قراءة ملفات الواجهة مباشرة من نفس مجلد المشروع
app.use(express.static(__dirname));

// قاعدة بيانات وهمية مؤقتة (لغرض التجربة)
let databaseCodes = {
    "GHOST-1234": { status: "active" },
    "VIP-9999": { status: "active" }
};

// 1. مسار التحقق من الكود
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

// 2. مسار التفعيل التلقائي (وحرق الكود فقط عند النجاح التام)
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

        // محاكاة نجاح عملية التفعيل البنكي التلقائي
        let isActivationSuccessful = true; 

        if (isActivationSuccessful) {
            // ✅ هنا فقط يحترق الكود ويصبح مستخدماً بعد نجاح التفعيل
            databaseCodes[cdk].status = 'used';
            return res.status(200).json({ message: 'تم التفعيل بنجاح' });
        } else {
            // ❌ إذا فشل التفعيل، يبقى الكود سليماً تماماً!
            return res.status(400).json({ message: 'فشل التفعيل، الكود لم يتم حرقه' });
        }
    } catch (e) {
        res.status(400).json({ message: 'خطأ في صيغة البيانات' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
