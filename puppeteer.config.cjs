const { join } = require('path');

/**
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  // توجيه مسار تحميل الكروم إلى مجلد ثابت داخل المشروع لكي لا يضيع أثناء التشغيل
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
