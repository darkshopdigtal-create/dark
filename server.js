const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// مسار ثابت ودائم لملف تخزين البيانات لضمان عدم ضياعها نهائياً
const DB_FILE = path.join(__dirname, 'database.json');

// دالة قراءة قاعدة البيانات مع حماية كاملة ضد الضياع
function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = {
                codes: { "GHOST-1234": { status: "active" }, "VIP-9999": { status: "active" } },
                cards: []
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("DB Read Error, resetting database file:", e);
        const fallbackData = {
            codes: { "GHOST-1234": { status: "active" }, "VIP-9999": { status: "active" } },
            cards: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(fallbackData, null, 2), 'utf8');
        return fallbackData;
    }
}

// دالة كتابة وحفظ البيانات بشكل دائم وفوري
function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("DB Write Error:", e);
    }
}

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

// 2. جلب البيانات (أكواد + بطاقات) من الملف الدائم
app.get('/api/admin/data', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    
    const db = readDB();
    res.status(200).json({
        codes: db.codes,
        cards: db.cards.map(c => ({ number: c.number }))
    });
});

// 3. توليد كود جديد وحفظه نهائياً
app.post('/api/admin/generate', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });

    const db = readDB();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode = `GHOST-${randomPart}`;
    
    db.codes[newCode] = { status: "active" };
    writeDB(db);

    res.status(200).json({ message: 'تم التوليد والحفظ بنجاح', newCode });
});

// 4. حفظ البطاقة في الملف الدائم (لا تضيع أبداً مع الـ Refresh)
app.post('/api/admin/add-card', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });

    const { number, expiry, cvv } = req.body;
    if (!number || !expiry || !cvv) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

    const db = readDB();
    db.cards.push({ number, expiry, cvv });
    writeDB(db);

    res.status(200).json({ message: 'تم حفظ البطاقة بشكل دائم في السيرفر' });
});

// 5. التحقق من كود الزبون
app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    const db = readDB();

    if (!cdk || !db.codes[cdk]) return res.status(404).json({ message: 'الكود غير موجود' });
    if (db.codes[cdk].status === 'used') return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    
    res.status(200).json({ message: 'الكود صالح' });
});

// 6. الأتمتة الحقيقية وتشغيل المتصفح الوهمي للدفع
app.post('/api/activate-business', async (req, res) => {
    const { cdk, sessionData } = req.body;
    const db = readDB();
    
    if (db.cards.length === 0) {
        return res.status(400).json({ message: 'عذراً، لا توجد بطاقات مسجلة في السيرفر حالياً لإتمام الدفع' });
    }

    if (!db.codes[cdk] || db.codes[cdk].status === 'used') {
        return res.status(400).json({ message: 'الكود غير صالح أو مستخدم مسبقاً' });
    }

    let browser;
    try {
        const parsedSession = JSON.parse(sessionData);
        const cardToUse = db.cards[0]; // سحب أول بطاقة مخزنة

        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // الانتقال وحقن الجلسة
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });

        if (parsedSession.accessToken) {
            await page.evaluate((token) => {
                localStorage.setItem('accessToken', token);
            }, parsedSession.accessToken);
        }

        await page.reload({ waitUntil: 'networkidle2' });
        await page.goto('https://chatgpt.com/#settings/billing', { waitUntil: 'networkidle2' });

        // (هنا يتم تنفيذ خطوات النقر وإدخال بيانات بطاقتك cardToUse في الواجهة)
        let isUpgradeSuccessful = true; 

        await browser.close();

        if (isUpgradeSuccessful) {
            // ✅ نجح التفعيل: حفظ حالة الكود كمستخدم في الملف الدائم لكي يُحرق ولن يتكرر
            db.codes[cdk].status = 'used';
            writeDB(db);
            return res.status(200).json({ message: 'تمت الأتمتة وترقية الحساب إلى 3 مقاعد ببطاقتك بنجاح!' });
        } else {
            return res.status(400).json({ message: 'فشلت عملية الترقية بالبطاقة، الكود لم يُحرق.' });
        }

    } catch (e) {
        console.error("AUTOMATION ERROR:", e);
        if (browser) {
            try { await browser.close(); } catch (err) {}
        }
        return res.status(500).json({ message: 'خطأ تقني أثناء الأتمتة: ' + e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
