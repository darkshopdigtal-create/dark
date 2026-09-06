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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 1. تسجيل الدخول بحساب الزبون
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
        if (parsedSession.accessToken) {
            await page.evaluate((token) => {
                localStorage.setItem('accessToken', token);
            }, parsedSession.accessToken);
        }
        await page.reload({ waitUntil: 'networkidle2' });

        // 2. الانتقال لصفحة الفوترة
        await page.goto('https://chatgpt.com/#settings/billing', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 5000)); // انتظار تحميل العرض

        // 📸 التقاط صورة فورية لما يراه المتصفح في صفحة الفوترة قبل أي نقر
        const screenshotPath = path.join(__dirname, 'billing-page-view.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("تم حفظ صورة شاشة لصفحة الفوترة باسم: billing-page-view.png");

        // محاولة النقر على زر الترقية إذا وجد
        const clickedUpgrade = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const target = buttons.find(el => el.innerText.includes('Upgrade') || el.innerText.includes('ترقية') || el.innerText.includes('Team'));
            if (target) {
                target.click();
                return true;
            }
            return false;
        });

        await new Promise(r => setTimeout(r, 3000));

        // 📸 التقاط صورة ثانية بعد محاولة النقر لمعرفة هل ظهرت حقول البطاقة أم لا
        const resultScreenshotPath = path.join(__dirname, 'after-click-view.png');
        await page.screenshot({ path: resultScreenshotPath, fullPage: true });

        await browser.close();

        // بدلاً من إعطاء نجاح وهمي، سنخبرك بالنتيجة الفعلية لمحاولة النقر
        if (clickedUpgrade) {
            return res.status(200).json({ 
                message: 'تم العثور على زر الترقية والنقر عليه بنجاح! (تم حفظ صور الشاشة في السيرفر لفحصها).' 
            });
        } else {
            return res.status(400).json({ 
                message: 'فشل التفعيل: لم يتمكن المتصفح من إيجاد زر "Upgrade" أو عرض الترقية في الصفحة بشكل تلقائي.' 
            });
        }

    } catch (e) {
        console.error("AUTOMATION ERROR:", e);
        if (browser) {
            try { await browser.close(); } catch (err) {}
        }
        return res.status(500).json({ message: 'خطأ تقني: ' + e.message });
    }
});
