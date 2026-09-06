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

// 💡 بطاقتك مثبتة هنا كقاعدة أساسية جاهزة للدفع أوتوماتيكياً
const INITIAL_DB_STATE = {
    codes: { "GHOST-1234": { status: "active" }, "VIP-9999": { status: "active" } },
    cards: [
        {
            number: "5556597906083383",
            expiry: "0928",
            cvv: "075"
        }
    ]
};

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB_STATE, null, 2), 'utf8');
            return INITIAL_DB_STATE;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB_STATE, null, 2), 'utf8');
        return INITIAL_DB_STATE;
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
    res.status(200).json({ message: 'تم التوليد بنجاح', newCode });
});

app.post('/api/admin/add-card', (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    const { number, expiry, cvv } = req.body;
    if (!number || !expiry || !cvv) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    const db = readDB();
    db.cards.push({ number, expiry, cvv });
    writeDB(db);
    res.status(200).json({ message: 'تم الحفظ' });
});

app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    const db = readDB();
    if (!cdk || !db.codes[cdk]) return res.status(404).json({ message: 'الكود غير موجود' });
    if (db.codes[cdk].status === 'used') return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    res.status(200).json({ message: 'الكود صالح' });
});

// 🚀 مسار الأتمتة النهائي مع تنظيف قوي للكوكيز
app.post('/api/activate-business', async (req, res) => {
    const { cdk, sessionData } = req.body;
    const db = readDB();
    
    if (db.cards.length === 0) {
        return res.status(400).json({ message: 'لا توجد بطاقات مسجلة.' });
    }

    if (!db.codes[cdk] || db.codes[cdk].status === 'used') {
        return res.status(400).json({ message: 'الكود غير صالح أو مستخدم مسبقاً' });
    }

    let sessionToken = null;
    let accessToken = null;

    // محاولة استخراج التوكن بطريقتين لضمان عدم الفشل
    try {
        let parsed = JSON.parse(sessionData);
        if (parsed.rawData) parsed = JSON.parse(parsed.rawData);
        sessionToken = parsed.sessionToken;
        accessToken = parsed.accessToken;
    } catch (err) {
        const sessionMatch = sessionData.match(/"sessionToken"\s*:\s*"([^"]+)"/);
        const accessMatch = sessionData.match(/"accessToken"\s*:\s*"([^"]+)"/);
        if (sessionMatch) sessionToken = sessionMatch[1];
        if (accessMatch) accessToken = accessMatch[1];
    }

    if (!sessionToken || !accessToken) {
        return res.status(400).json({ message: 'البيانات ناقصة. تأكد من لصق الجلسة بالكامل.' });
    }

    // 🧹 التنظيف العنيف: إزالة أي مسافات، نزول سطر، أو علامات اقتباس من التوكنات
    const cleanSessionToken = String(sessionToken).replace(/[\r\n\s"']/g, '').trim();
    const cleanAccessToken = String(accessToken).replace(/[\r\n\s"']/g, '').trim();

    // 🔍 طباعة معلومات آمنة في الكونسول (Render Logs) لمعرفة حالة التوكن قبل حقنه
    console.log("--- Token Safety Check ---");
    console.log({
        sessionTokenType: typeof cleanSessionToken,
        sessionTokenLength: cleanSessionToken.length,
        hasNewline: /[\r\n]/.test(cleanSessionToken),
        hasSpaces: /\s/.test(cleanSessionToken)
    });
    console.log("--------------------------");

    const cardToUse = db.cards[0];
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--lang=en-US,en'
            ]
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(60000);

        await page.emulateTimezone('America/New_York');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 1. الانتقال للموقع لتهيئة الدومين
        await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });

        // 2. حقن الكوكيز الآن بعد التنظيف الصارم
        await page.setCookie({
            name: '__Secure-next-auth.session-token',
            value: cleanSessionToken,
            domain: '.chatgpt.com', // يفضل وضع النقطة قبل الدومين لضمان الشمولية
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'Lax'
        });

        await page.evaluate((token) => {
            localStorage.setItem('accessToken', token);
        }, cleanAccessToken);

        // 3. الانتقال لصفحة الفوترة وتخطي تسجيل الدخول
        await page.goto('https://chatgpt.com/#settings/billing', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 6000));

        const currentUrl = page.url();
        const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 300).replace(/\n/g, ' '));

        if (currentUrl.includes('login') || bodySnippet.includes('Log in')) {
            await browser.close();
            return res.status(400).json({ message: 'فشل تخطي تسجيل الدخول. تأكد أن الجلسة ما زالت فعالة غير مسجلة خروج.' });
        }

        // 4. النقر على الترقية
        const clickedUpgrade = await page.evaluate(() => {
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

        if (!clickedUpgrade) {
            await browser.close();
            return res.status(400).json({ message: 'لم يتم العثور على زر الترقية في حساب الزبون.' });
        }

        await new Promise(r => setTimeout(r, 4000));

        // 5. تعديل عدد المقاعد
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const seatsInput = inputs.find(input => input.value == '5' || input.type === 'number');
            if (seatsInput) {
                seatsInput.value = '3';
                seatsInput.dispatchEvent(new Event('input', { bubbles: true }));
                seatsInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await new Promise(r => setTimeout(r, 2000));

        // 6. حقن بيانات البطاقة
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const cardInput = await frame.$('input[name="cardnumber"]');
                if (cardInput) {
                    await frame.type('input[name="cardnumber"]', cardToUse.number, { delay: 30 });
                    await frame.type('input[name="exp-date"]', cardToUse.expiry, { delay: 30 });
                    await frame.type('input[name="cvc"]', cardToUse.cvv, { delay: 30 });
                    break;
                }
            } catch (err) {}
        }

        // 7. إدخال العنوان وتجنب الضريبة
        await page.evaluate(() => {
            const nameInput = document.querySelector('input[name="name"]');
            if (nameInput) {
                nameInput.value = "Foad Ghost";
                nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const stateSelect = document.querySelector('select[name="state"]');
            if (stateSelect) {
                stateSelect.value = 'OR';
                stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const zipInput = document.querySelector('input[name="postal_code"]') || document.querySelector('input[name="address[postal_code]"]');
            if (zipInput) {
                zipInput.value = "97301";
                zipInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // 8. ضغطة الدفع النهائية
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const payBtn = buttons.find(el => el.innerText.includes('Subscribe') || el.innerText.includes('Pay'));
            if (payBtn) payBtn.click();
        });

        await new Promise(r => setTimeout(r, 6000));
        await browser.close();

        // ✅ حرق الـ CDK
        db.codes[cdk].status = 'used';
        writeDB(db);

        return res.status(200).json({ message: 'تم التفعيل بنجاح! تم تطبيق الباقة بـ 3 مقاعد واستخدام البطاقة المثبتة.' });

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
