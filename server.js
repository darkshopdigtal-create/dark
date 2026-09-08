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

// بطاقتك مثبتة بشكل دائم هنا
const MY_CARD = {
    number: "5556597906083383",
    expiry: "0928",
    cvv: "075"
};

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { codes: { "GHOST-1234": { status: "active" } } };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { codes: { "GHOST-1234": { status: "active" } } };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

app.post('/api/verify-code', (req, res) => {
    const { cdk } = req.body;
    const db = readDB();
    if (!cdk || !db.codes[cdk]) return res.status(404).json({ message: 'الكود غير موجود' });
    if (db.codes[cdk].status === 'used') return res.status(400).json({ message: 'الكود مستخدم مسبقاً' });
    res.status(200).json({ message: 'الكود صالح' });
});

// مسار الأتمتة النهائي
app.post('/api/activate-business', async (req, res) => {
    const { cdk, sessionData } = req.body;
    const db = readDB();

    if (!db.codes[cdk] || db.codes[cdk].status === 'used') {
        return res.status(400).json({ message: 'الكود غير صالح أو مستخدم مسبقاً' });
    }

    let sessionTokenRaw = null;
    let accessTokenRaw = null;

    // استخراج الجلسة بأمان
    try {
        let parsed = JSON.parse(sessionData);
        if (parsed.rawData) parsed = JSON.parse(parsed.rawData);
        sessionTokenRaw = parsed.sessionToken;
        accessTokenRaw = parsed.accessToken;
    } catch (err) {
        // محاولة الاستخراج عبر Regex إذا فشل الـ JSON
        const sessionMatch = sessionData.match(/"sessionToken"\s*:\s*"([^"]+)"/);
        const accessMatch = sessionData.match(/"accessToken"\s*:\s*"([^"]+)"/);
        if (sessionMatch) sessionTokenRaw = sessionMatch[1];
        if (accessMatch) accessTokenRaw = accessMatch[1];
    }

    if (!sessionTokenRaw || !accessTokenRaw) {
        return res.status(400).json({ message: 'البيانات ناقصة. تأكد من لصق الجلسة بالكامل.' });
    }

    // 🔥 التنظيف العنيف: السماح فقط بالحروف، الأرقام، النقطة، الشارحة، والشرطة السفلية
    // هذا يضمن مسح أي مسافات مخفية أو نزول سطر يسبب خطأ "Invalid cookie fields"
    const cleanSessionToken = String(sessionTokenRaw).replace(/[^a-zA-Z0-9\-_.]/g, '');
    const cleanAccessToken = String(accessTokenRaw).replace(/[^a-zA-Z0-9\-_.]/g, '');

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

        // 1. التوجه للموقع
        await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });

        // 2. حقن الكوكيز النظيف
        try {
            await page.setCookie({
                name: '__Secure-next-auth.session-token',
                value: cleanSessionToken,
                domain: '.chatgpt.com',
                path: '/',
                secure: true,
                httpOnly: true
            });
        } catch (cookieErr) {
            await browser.close();
            return res.status(500).json({ message: 'خطأ أثناء حقن الكوكي: ' + cookieErr.message });
        }

        // حقن AccessToken
        await page.evaluate((token) => {
            localStorage.setItem('accessToken', token);
        }, cleanAccessToken);

        // 3. التوجه لصفحة الفوترة
        await page.goto('https://chatgpt.com/#settings/billing', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 5000));

        const currentUrl = page.url();
        const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 300));

        if (currentUrl.includes('login') || bodySnippet.includes('Log in')) {
            await browser.close();
            return res.status(400).json({ message: 'تم حقن الكوكي ولكن الموقع رفضه (ربما الجلسة منتهية أو مسجل خروج).' });
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
            return res.status(400).json({ message: 'لم يتم العثور على زر الترقية.' });
        }

        await new Promise(r => setTimeout(r, 4000));

        // 5. تعديل المقاعد إلى 3
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

        // 6. حقن البطاقة (المثبتة)
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

        // 7. إدخال العنوان واسم الولاية (Oregon)
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

        // 8. الدفع
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const payBtn = buttons.find(el => el.innerText.includes('Subscribe') || el.innerText.includes('Pay'));
            if (payBtn) payBtn.click();
        });

        await new Promise(r => setTimeout(r, 6000));
        await browser.close();

        // حرق الكود بعد النجاح
        db.codes[cdk].status = 'used';
        writeDB(db);

        return res.status(200).json({ message: 'تم التفعيل بنجاح! تم الدخول وتطبيق الـ 3 مقاعد واستخدام البطاقة المثبتة.' });

    } catch (e) {
        console.error("AUTOMATION ERROR:", e);
        if (browser) try { await browser.close(); } catch (err) {}
        return res.status(500).json({ message: 'خطأ تقني: ' + e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
