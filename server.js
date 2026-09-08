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

// 🔴 ضع رابط العرض السري الخاص بك هنا
const SECRET_PROMO_LINK = "https://chatgpt.com/?promoCode=BWND2QUPKGG6UQSU";

// 💡 بطاقتك المثبتة
const MY_CARD = {
    number: "5556597906083383",
    expiry: "0928",
    cvv: "075"
};

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { codes: { "ALPHA-1234": { status: "active" } } };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { codes: { "ALPHA-1234": { status: "active" } } };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

const ADMIN_PASSWORD = "FOAD_SECRET_ADMIN_2026";
const ADMIN_TOKEN = "Bearer-Secret-Token-123456";

app.get('/', (req, res) => {
    res.status(200).send('Alpha Digital Server is Running 100%!');
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) return res.status(200).json({ token: ADMIN_TOKEN });
    res.status(401).json({ message: 'كلمة المرور خاطئة!' });
});

app.get('/api/admin/data', (req, res) => {
    if (req.headers['authorization'] !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    res.status(200).json({ codes: readDB().codes });
});

app.post('/api/admin/generate', (req, res) => {
    if (req.headers['authorization'] !== ADMIN_TOKEN) return res.status(403).json({ message: 'غير مسموح' });
    const db = readDB();
    const newCode = `ALPHA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    db.codes[newCode] = { status: "active" };
    writeDB(db);
    res.status(200).json({ message: 'تم التوليد بنجاح', newCode });
});

app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    const db = readDB();
    if (!cdk || !db.codes[cdk]) return res.status(404).json({ message: 'الكود غير موجود' });
    if (db.codes[cdk].status === 'used') return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    res.status(200).json({ message: 'الكود صالح' });
});

// 🚀 الأتمتة مع ميزة "البث المباشر" للخطوات (SSE) والتحقق من الدفع
app.post('/api/activate-business', async (req, res) => {
    // إعداد الاتصال كبث مباشر (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendUpdate = (msg, status = 'info') => {
        res.write(`data: ${JSON.stringify({ message: msg, status })}\n\n`);
    };

    const { cdk, sessionData } = req.body;
    const db = readDB();

    if (!db.codes[cdk] || db.codes[cdk].status === 'used') {
        sendUpdate('الكود غير صالح أو مستخدم مسبقاً', 'error');
        return res.end();
    }

    sendUpdate('✅ تم التحقق من الكود بنجاح. جاري استخراج بيانات الجلسة...');

    let sessionTokenRaw = null;
    let accessTokenRaw = null;

    try {
        let parsed = JSON.parse(sessionData);
        if (parsed.rawData) parsed = JSON.parse(parsed.rawData);
        sessionTokenRaw = parsed.sessionToken;
        accessTokenRaw = parsed.accessToken;
    } catch (err) {
        const sessionMatch = sessionData.match(/"sessionToken"\s*:\s*"([^"]+)"/);
        const accessMatch = sessionData.match(/"accessToken"\s*:\s*"([^"]+)"/);
        if (sessionMatch) sessionTokenRaw = sessionMatch[1];
        if (accessMatch) accessTokenRaw = accessMatch[1];
    }

    if (!sessionTokenRaw || !accessTokenRaw) {
        sendUpdate('❌ البيانات ناقصة. تأكد من لصق الجلسة بالكامل.', 'error');
        return res.end();
    }

    const cleanSessionToken = String(sessionTokenRaw).replace(/[^a-zA-Z0-9\-_.]/g, '');
    const cleanAccessToken = String(accessTokenRaw).replace(/[^a-zA-Z0-9\-_.]/g, '');

    let browser;
    try {
        sendUpdate('🌐 جاري فتح المتصفح الآلي...');
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(90000); 

        sendUpdate('🔑 جاري تسجيل الدخول للحساب عبر الكوكيز...');
        await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });

        await page.evaluate((sessionToken, accessToken) => {
            document.cookie = `__Secure-next-auth.session-token=${sessionToken}; path=/; domain=.chatgpt.com; Secure; SameSite=Lax`;
            localStorage.setItem('accessToken', accessToken);
        }, cleanSessionToken, cleanAccessToken);

        sendUpdate('🔗 جاري القفز إلى رابط العرض السري...');
        await page.goto(SECRET_PROMO_LINK, { waitUntil: 'domcontentloaded' });
        
        await new Promise(r => setTimeout(r, 6000));
        
        const currentUrl = page.url();
        const bodySnippet = await page.evaluate(() => document.body.innerText.toLowerCase().substring(0, 300));
        
        if (currentUrl.includes('login') || bodySnippet.includes('log in')) {
            sendUpdate('❌ فشل الدخول! الجلسة منتهية الصلاحية من المصدر.', 'error');
            await browser.close();
            return res.end();
        }

        sendUpdate('✅ تم تخطي تسجيل الدخول والوصول لصفحة الفوترة.');

        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const acceptBtn = buttons.find(btn => btn.innerText.toLowerCase().includes('continue'));
            if (acceptBtn) acceptBtn.click();
        });

        await new Promise(r => setTimeout(r, 4000));

        sendUpdate('👥 جاري تعديل عدد المقاعد إلى 3...');
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

        sendUpdate('💳 جاري حقن بيانات البطاقة والعنوان...');
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const cardInput = await frame.$('input[name="cardnumber"]');
                if (cardInput) {
                    await frame.type('input[name="cardnumber"]', MY_CARD.number, { delay: 30 });
                    await frame.type('input[name="exp-date"]', MY_CARD.expiry, { delay: 30 });
                    await frame.type('input[name="cvc"]', MY_CARD.cvv, { delay: 30 });
                    break;
                }
            } catch (err) {}
        }

        await page.evaluate(() => {
            const nameInput = document.querySelector('input[name="name"]');
            if (nameInput) { nameInput.value = "Foad Ghost"; nameInput.dispatchEvent(new Event('input', { bubbles: true })); }
            const stateSelect = document.querySelector('select[name="state"]');
            if (stateSelect) { stateSelect.value = 'OR'; stateSelect.dispatchEvent(new Event('change', { bubbles: true })); }
            const zipInput = document.querySelector('input[name="postal_code"]') || document.querySelector('input[name="address[postal_code]"]');
            if (zipInput) { zipInput.value = "97301"; zipInput.dispatchEvent(new Event('input', { bubbles: true })); }
        });

        sendUpdate('⏳ جاري النقر على زر الدفع، ننتظر رد البنك (يرجى الانتظار)...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const payBtn = buttons.find(el => el.innerText.includes('Subscribe') || el.innerText.includes('Pay'));
            if (payBtn) payBtn.click();
        });

        // 🔥 التحقق الفعلي من الدفع: ينتظر 15 ثانية ويقرأ الشاشة
        const paymentCheck = await page.evaluate(async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            for(let i=0; i<15; i++) {
                await sleep(1000);
                const text = document.body.innerText.toLowerCase();
                if (text.includes('declined') || text.includes('insufficient') || text.includes('unsuccessful') || text.includes('failed')) {
                    return { success: false, reason: "البطاقة مرفوضة أو لا تحتوي على رصيد كافي." };
                }
                if (text.includes('payment successful') || text.includes('welcome') || window.location.href.includes('success')) {
                    return { success: true };
                }
            }
            return { success: null, reason: "انتهى وقت الفحص ولم نتمكن من التأكد من حالة الدفع." };
        });

        await browser.close();

        if (paymentCheck.success === false) {
            sendUpdate(`❌ فشل الدفع: ${paymentCheck.reason}`, 'error');
            return res.end();
        }

        if (paymentCheck.success === null) {
            sendUpdate(`⚠️ تحذير: ${paymentCheck.reason}`, 'error');
            return res.end();
        }

        // فقط إذا نجح الدفع 100%، نحرق الكود!
        db.codes[cdk].status = 'used';
        writeDB(db);

        sendUpdate('🎉 تمت عملية الدفع والتفعيل بنجاح! تم تطبيق البطاقة و 3 مقاعد.', 'success');
        res.end();

    } catch (e) {
        if (browser) try { await browser.close(); } catch (err) {}
        sendUpdate(`❌ خطأ تقني: ${e.message}`, 'error');
        res.end();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
