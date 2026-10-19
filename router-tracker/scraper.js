require('dotenv').config({ path: './login.env' });
const puppeteer = require('puppeteer');

// Optimized helper function for quick safety buffers
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeRouterData() {
  const browser = await puppeteer.launch({ 
    headless: "new", // Run cleanly in the background without popping up windows
    args: [
      '--ignore-certificate-errors', 
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--window-size=1280,800'
    ] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    const routerUrl = `http://${process.env.ROUTER_IP || '192.168.0.1'}`;
    console.log(`📡 Connecting to router dashboard at: ${routerUrl}`);
    await page.goto(routerUrl, { waitUntil: 'networkidle2' });

    // 1. Password Field Entry
    const passwordSelector = 'input[type="password"], #txtPwd, #password';
    await page.waitForSelector(passwordSelector, { visible: true, timeout: 5000 });
    await page.type(passwordSelector, process.env.ROUTER_PASSWORD);
    
    const loginBtn = 'input[type="submit"], button#btnLogin, #loginBtn, .login-btn';
    await page.click(loginBtn);
    
    console.log("🔑 Authenticated successfully. Waiting briefly for interface elements...");
    await delay(3000); // Optimized down from 25 seconds

    // 2. Direct Navigation Click Injection
    const dataUsageLinkSelector = 'a[href="#traffic_alert"]';
    await page.waitForSelector(dataUsageLinkSelector, { timeout: 5000 });
    
    console.log("🖱️ Sidebar active. Triggering Data Usage link...");
    await page.evaluate(() => {
      const targetAnchor = document.querySelector('a[href="#traffic_alert"]');
      if (targetAnchor) {
        targetAnchor.click();
        return true;
      }
      return false;
    });
    
    // Quick pause to let the network stats numbers settle on the canvas
    await delay(2500); 

    // 3. Live Value Extraction
    console.log("📊 Scraping text nodes for data metrics...");
    const usageData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      
      function parseMetricToBytes(text, keyword) {
        const regex = new RegExp(keyword + '[\\s\\W]*([0-9.]+)\\s*(TB|GB|MB|KB)?', 'i');
        const match = text.match(regex);
        if (!match) return 0;
        
        const numericValue = parseFloat(match[1]);
        const unitToken = match[2] ? match[2].toUpperCase() : 'GB';
        
        if (unitToken === 'TB') return Math.round(numericValue * 1024 * 1024 * 1024 * 1024);
        if (unitToken === 'GB') return Math.round(numericValue * 1024 * 1024 * 1024);
        if (unitToken === 'MB') return Math.round(numericValue * 1024 * 1024);
        return Math.round(numericValue);
      }

      // Explicit target hook pulled directly from your working Cool Ideas firmware layout
      let totalBytes = parseMetricToBytes(bodyText, 'Monthly Usage');

      // Universal fallback scanner if the text is deeper in the document structure
      if (totalBytes === 0) {
        const structuralElements = Array.from(document.querySelectorAll('td, span, div, p, label'));
        const targetElement = structuralElements.find(el => el.innerText.includes('Monthly Usage') || el.innerText.includes('TB'));
        if (targetElement) {
          totalBytes = parseMetricToBytes(targetElement.innerText, '');
        }
      }

      return {
        download: totalBytes, 
        upload: 0,
        total: totalBytes
      };
    });

    if (!usageData || usageData.total === 0) {
      throw new Error("Unable to parse text string arrays. Data values returned zero.");
    }

    console.log(`💾 Scraper pulled live volume size metrics cleanly: ${(usageData.total / (1024*1024*1024)).toFixed(2)} GB`);
    return usageData;

  } catch (error) {
    console.error("❌ ZTE 7d2885 scraping operation failed:", error.message);
    // Silent backup screenshot in case of unexpected future failures
    await page.screenshot({ path: 'error_screenshot.png' }).catch(() => {});
    return null;
  } finally {
    // Gracefully terminate the headless window context [1]
    await browser.close();
  }
}

module.exports = scrapeRouterData;
