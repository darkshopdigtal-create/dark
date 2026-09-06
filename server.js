const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'database.json');

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
        const fallbackData = {
            codes: { "GHOST-1234": { status: "active" }, "VIP-9999": { status: "active" } },
            cards: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(fallbackData, null, 2), 'utf8');
        return fallbackData;
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error("DB Write Error:", e);
    }
}

const ADMIN_PASSWORD = "FOAD_SECRET_ADMIN_2026";
const ADMIN_TOKEN = "Bearer-Secret-Token-123456";

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.status(200).json({ token: ADMIN_TOKEN });
    }
    res.status(401).json({ message: 'كلمة المرور خاطئة!' });
});

app.get('/api/admin/data', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    const db = readDB();
    res.status(200).json({ codes: db.codes, cards: db.cards.map(c => ({ number: c.number })) });
});

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

app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    const db = readDB();
    if (!cdk || !db.codes[cdk]) return res.status(404).json({ message: 'الكود غير موجود' });
    if (db.codes[cdk].status === 'used') return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    res.status(200).json({ message: 'الكود صالح' });
});

// 🚀 الأتمتة المتقدمة مع محاكاة المتصفح الأمريكي وكشف النص الحقيقي تماماً
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
        const cardToUse = db.cards[0];

        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--lang=en-US,en' // فرض لغة المتصفح الأمريكية
            ]
        });

        const page = await browser.newPage();
        
        // ضبط المنطقة الزمنية واللغة لتبدو أمريكية تماماً
        await page.emulateTimezone('America/New_York');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 1. الدخول لموقع ChatGPT
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });

        if (parsedSession.accessToken) {
            await page.evaluate((token) => {
                localStorage.setItem('accessToken', token);
            }, parsedSession.accessToken);
        }

        await page.reload({ waitUntil: 'networkidle2' });

        // 2. الانتقال لصفحة الفوترة
        await page.goto('https://chatgpt.com/#settings/billing', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 6000)); // انتظار أطول لتحميل العرض الأمريكي

        const currentUrl = page.url();
        
        // سحب أجزاء من النص الظاهر على الشاشة ليريك بالضبط ما الذي يواجهه المتصفح
        const bodySnippet = await page.evaluate(() => {
            return document.body.innerText.substring(0, 400).replace(/\n/g, ' ');
        });

        // فحص إذا تم تحويله لتسجيل الدخول
        if (currentUrl.includes('login') || bodySnippet.includes('Log in') || bodySnippet.includes('Sign up')) {
            await browser.close();
            return res.status(400).json({ 
                message: `واجه المتصفح مشكلة تسجيل دخول: الرابط الحالي هو (${currentUrl}). والنص الظاهر على الصفحة هو: [${bodySnippet}]` 
            });
        }

        // 3. محاولة النقر على زر الترقية
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const target = buttons.find(el => {
                const text = el.innerText.toLowerCase();
                return text.includes('upgrade') || text.includes('team') || text.includes('business');
            });
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            await browser.close();
            return res.status(400).json({ 
                message: `لم يجد المتصفح زر الترقية! محتوى الصفحة الظاهر حالياً: [${bodySnippet}]` 
            });
        }

        await new Promise(r => setTimeout(r, 3000));
        await browser.close();

        // ✅ نجاح العملية وحرق الكود
        db.codes[cdk].status = 'used';
        writeDB(db);

        return res.status(200).json({ message: 'تم النقر على زر الترقية بنجاح وتفعيل الحساب!' });

    } catch (e) {
        console.error("AUTOMATION ERROR:", e);
        if (browser) {
            try { await browser.close(); } catch (err) {}
        }
        return res.status(500).json({ message: 'خطأ تقني: ' + e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
