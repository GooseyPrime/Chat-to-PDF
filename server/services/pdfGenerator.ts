import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';

// Function to check if Chrome executable exists
async function findChrome(): Promise<string> {
  // Check environment variable first (for Docker/production environments)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    try {
      await fs.access(process.env.PUPPETEER_EXECUTABLE_PATH);
      console.log(`Found Chrome from environment: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    } catch {
      console.warn(`Chrome executable path from environment not accessible: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    }
  }

  const chromePaths = [
    '/usr/bin/google-chrome-stable', // Docker image path
    '/usr/bin/google-chrome',
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    'chromium-browser',
    'chromium',
    'google-chrome',
    'chrome'
  ];
  
  for (const chromePath of chromePaths) {
    try {
      await fs.access(chromePath);
      console.log(`Found Chrome at: ${chromePath}`);
      return chromePath;
    } catch {
      // Try next path
    }
  }
  
  // Default fallback
  console.warn(`No Chrome executable found. Falling back to: ${chromePaths[0]}`);
  return chromePaths[0];
}

export async function generatePdf(
  url: string, 
  recordId: string, 
  addWatermark: boolean = false
): Promise<{ size: number; downloadUrl: string; fileName: string }> {
  let browser;
  
  try {
    const executablePath = await findChrome();
    console.log(`🌐 Using Chrome executable: ${executablePath}`);
    
    // Attempt Chrome launch with retry logic
    let browserAttempt = 0;
    const maxAttempts = 3;
    
    while (browserAttempt < maxAttempts) {
      try {
        browserAttempt++;
        console.log(`🚀 Chrome launch attempt ${browserAttempt}/${maxAttempts}`);
        
        browser = await puppeteer.launch({
          executablePath,
          headless: true,
          timeout: 120000, // 2 minutes
          protocolTimeout: 120000, // 2 minutes protocol timeout
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-features=VizDisplayCompositor',
            '--disable-web-security',
            '--disable-features=site-per-process',
            '--allow-running-insecure-content',
            '--disable-blink-features=AutomationControlled',
            '--disable-component-extensions-with-background-pages',
            '--disable-default-apps',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-pings',
            '--disable-background-networking',
            '--disable-component-update',
            '--disable-domain-reliability'
          ]
        });
        
        console.log(`✅ Chrome launched successfully on attempt ${browserAttempt}`);
        break;
        
      } catch (launchError: any) {
        console.error(`❌ Chrome launch attempt ${browserAttempt} failed:`, launchError.message);
        
        if (browserAttempt === maxAttempts) {
          throw new Error(`Failed to launch Chrome after ${maxAttempts} attempts: ${launchError.message}`);
        }
        
        // Wait before retry
        console.log(`⏳ Waiting 5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    if (!browser) {
      throw new Error('Browser failed to initialize after all attempts');
    }
    
    console.log(`✅ Chrome browser launched successfully`);

    const page = await browser.newPage();
    
    // Configure page with extended timeouts
    await page.setDefaultTimeout(120000); // 2 minutes for page operations
    await page.setDefaultNavigationTimeout(120000); // 2 minutes for navigation
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    console.log(`🌐 Navigating to: ${url}`);
    
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      console.log(`✅ Page loaded successfully`);
    } catch (navError: any) {
      console.warn(`⚠️ Navigation timeout, proceeding anyway:`, navError.message);
      // Continue anyway as the page might have partially loaded
    }

    // Wait for content to fully load
    console.log(`⏳ Waiting for content to stabilize...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced wait time

    // Clean up the page for better PDF output
    console.log(`🧹 Cleaning up page elements...`);
    await page.evaluate(() => {
      // Remove common UI elements that shouldn't be in PDF
      const selectorsToRemove = [
        'button:contains("Copy")',
        'button:contains("Share")',
        'button:contains("Regenerate")',
        '[data-testid="conversation-turn-share-button"]',
        '.sticky',
        '[class*="sticky"]',
        'nav',
        'header',
        'footer',
        '[role="banner"]',
        '[role="navigation"]',
        '[role="complementary"]',
        '.sidebar',
        '[class*="sidebar"]',
        '[class*="nav"]',
        '[class*="menu"]',
        '[class*="toolbar"]',
        '[class*="controls"]',
        'script',
        'style[data-styled]',
        '.ad',
        '[class*="ad-"]',
        '[id*="ad-"]'
      ];

      selectorsToRemove.forEach(selector => {
        try {
          if (selector.includes(':contains(')) {
            // Handle pseudo-selector manually
            const text = selector.match(/contains\("([^"]+)"\)/)?.[1];
            if (text) {
              document.querySelectorAll('button').forEach(btn => {
                if (btn.textContent?.toLowerCase().includes(text.toLowerCase())) {
                  btn.remove();
                }
              });
            }
          } else {
            document.querySelectorAll(selector).forEach(el => el.remove());
          }
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Clean up whitespace and improve readability
      document.querySelectorAll('*').forEach(el => {
        const element = el as HTMLElement;
        if (element.style) {
          // Remove fixed positioning that might cause issues
          if (element.style.position === 'fixed' || element.style.position === 'sticky') {
            element.style.position = 'static';
          }
          // Remove transforms that might cause issues
          element.style.transform = '';
          element.style.transformOrigin = '';
        }
      });
    });

    // Add watermark if needed
    if (addWatermark) {
      console.log(`🏷️ Adding watermark...`);
      await page.evaluate(() => {
        const watermark = document.createElement('div');
        watermark.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 48px;
          color: rgba(0, 0, 0, 0.1);
          font-weight: bold;
          font-family: Arial, sans-serif;
          pointer-events: none;
          z-index: 9999;
          user-select: none;
        `;
        watermark.textContent = 'GPTPDF BASIC';
        document.body.appendChild(watermark);
      });
    }

    // Generate PDF with extended timeout
    console.log(`📄 Generating PDF...`);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      },
      preferCSSPageSize: true,
      timeout: 60000 // 1 minute for PDF generation
    });
    
    console.log(`✅ PDF generated, size: ${pdf.length} bytes`);

    // Save PDF to temporary location with consistent naming
    const fileName = `pdf-${recordId}-${nanoid()}.pdf`;
    const filePath = path.join('/tmp', fileName);
    await fs.writeFile(filePath, pdf);
    console.log(`💾 PDF saved to: ${filePath}`);

    // Store the filename for later retrieval
    const downloadUrl = `/api/download-pdf/${recordId}`;

    return {
      size: pdf.length,
      downloadUrl,
      fileName
    };

  } catch (error) {
    console.error('❌ PDF generation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      console.log(`🔚 Closing browser...`);
      await browser.close();
      console.log(`✅ Browser closed`);
    }
  }
}
