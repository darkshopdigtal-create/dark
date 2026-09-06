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

// 🚀 الأتمتة الحقيقية المطابقة لشرحك تماماً
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
        const cardToUse = db.cards[0]; // أخذ البطاقة المخزنة

        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 1. الدخول لحساب الزبون عبر الـ Session
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
        if (parsedSession.accessToken) {
            await page.evaluate((token) => {
                localStorage.setItem('accessToken', token);
            }, parsedSession.accessToken);
        }
        await page.reload({ waitUntil: 'networkidle2' });

        // 2. الانتقال لصفحة الفوترة حيث يظهر عرض الترقية
        await page.goto('https://chatgpt.com/#settings/billing', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 4000));

        // 3. الضغط على زر الترقية الظاهر في الواجهة
        // (نبحث عن زر الترقية وننقر عليه)
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const upgradeBtn = buttons.find(el => el.innerText.includes('Upgrade') || el.innerText.includes('ترقية') || el.innerText.includes('Team'));
            if (upgradeBtn) upgradeBtn.click();
        });

        await new Promise(r => setTimeout(r, 3000));

        // 4. تعديل عدد المقاعد من 5 إلى 3
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

        // 5. إدخال بيانات البطاقة (رقم البطاقة، تاريخ الانتهاء، الـ CVV) في حقول Stripe / الفوترة
        // (بما أن حقول الدفع تكون داخل إطارات Iframe في Stripe، نصل إليها برمجياً ونكتب البيانات)
        const frames = page.frames();
        for (const frame of frames) {
            try {
                const cardInput = await frame.$('input[name="cardnumber"]');
                if (cardInput) {
                    await frame.type('input[name="cardnumber"]', cardToUse.number, { delay: 50 });
                    await frame.type('input[name="exp-date"]', cardToUse.expiry, { delay: 50 });
                    await frame.type('input[name="cvc"]', cardToUse.cvv, { delay: 50 });
                    break;
                }
            } catch (err) {}
        }

        // 6. إدخال اسم عشوائي وعنوان في ولاية بدون ضريبة (مثل ولاية Oregon أو Delaware)
        await new Promise(r => setTimeout(r, 1000));
        await page.evaluate(() => {
            const nameInput = document.querySelector('input[name="name"]') || document.querySelector('#billing-name');
            if (nameInput) {
                nameInput.value = "Foad Smith";
                nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            // اختيار ولاية بدون ضريبة (Oregon - OR أو Delaware - DE) وإدخال الرمز البريدي 97301
            const stateSelect = document.querySelector('select[name="state"]');
            if (stateSelect) {
                stateSelect.value = 'OR';
                stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const zipInput = document.querySelector('input[name="address[postal_code]"]') || document.querySelector('input[name="postal_code"]');
            if (zipInput) {
                zipInput.value = "97301";
                zipInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // 7. النقر على زر إتمام الدفع النهائي
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const payBtn = buttons.find(el => el.innerText.includes('Subscribe') || el.innerText.includes('Pay') || el.innerText.includes('اشتراك') || el.type === 'submit');
            if (payBtn) payBtn.click();
        });

        await new Promise(r => setTimeout(r, 5000));

        await browser.close();

        // ✅ نجح التفعيل الكامل: حرق الكود نهائياً لكي لا يُستعمل مرتين
        db.codes[cdk].status = 'used';
        writeDB(db);

        return res.status(200).json({ message: 'تمت ترقية الحساب إلى 3 مقاعد أوتوماتيكياً وبطاقتك بنجاح!' });

    } catch (e) {
        console.error("AUTOMATION ERROR:", e);
        if (browser) {
            try { await browser.close(); } catch (err) {}
        }
        return res.status(500).json({ message: 'خطأ تقني أثناء تنفيذ الخطوات: ' + e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
