const puppeteer = require('puppeteer-core');
const chromeLauncher = require('chrome-launcher');

async function getChromePath() {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  await chrome.kill();
  return chrome.chromePath;
}

async function generatePdf(url) {
  const executablePath = await getChromePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  console.log("🌐 Navigating to:", url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Adjust DOM if necessary
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.innerText.toLowerCase().includes('copy')) btn.remove();
    });
  });

  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdf;
}

module.exports = generatePdf;
