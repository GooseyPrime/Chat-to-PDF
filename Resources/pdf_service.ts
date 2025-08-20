// server/services/pdfService.ts
import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { appConfig } from '../config/environment';
import { optimizedStorage } from '../storage/optimizedStorage';

interface PdfGenerationOptions {
  url: string;
  recordId: string;
  addWatermark: boolean;
  format?: 'A4' | 'Letter' | 'A3';
  quality?: 'high' | 'medium' | 'low';
  timeout?: number;
}

interface PdfGenerationResult {
  success: boolean;
  size: number;
  downloadUrl: string;
  fileName: string;
  processingTime: number;
  error?: string;
}

interface SecurityValidationResult {
  isValid: boolean;
  platform: string;
  errors: string[];
  warnings: string[];
}

class PdfService {
  private readonly allowedDomains = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'gemini.google.com',
    'bard.google.com',
  ];

  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly defaultTimeout = 300000; // 5 minutes
  private activeGenerations = new Map<string, { startTime: number; url: string }>();

  async generatePdf(options: PdfGenerationOptions): Promise<PdfGenerationResult> {
    const startTime = Date.now();
    const {
      url,
      recordId,
      addWatermark,
      format = 'A4',
      quality = 'high',
      timeout = this.defaultTimeout,
    } = options;

    // Track active generation
    this.activeGenerations.set(recordId, { startTime, url });

    try {
      // Security validation
      const validation = await this.validateUrl(url);
      if (!validation.isValid) {
        throw new Error(`Security validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate PDF
      const result = await this.generatePdfInternal(url, recordId, {
        addWatermark,
        format,
        quality,
        timeout,
        platform: validation.platform,
      });

      const processingTime = Date.now() - startTime;

      console.log(`✅ PDF generated successfully: ${recordId} in ${processingTime}ms`);

      return {
        success: true,
        size: result.size,
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`❌ PDF generation failed for ${recordId}:`, errorMessage);

      return {
        success: false,
        size: 0,
        downloadUrl: '',
        fileName: '',
        processingTime,
        error: errorMessage,
      };

    } finally {
      // Clean up tracking
      this.activeGenerations.delete(recordId);
    }
  }

  private async validateUrl(url: string): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      isValid: true,
      platform: 'unknown',
      errors: [],
      warnings: [],
    };

    try {
      const parsedUrl = new URL(url);
      
      // Check protocol
      if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
        result.errors.push('Invalid protocol. Only HTTP and HTTPS are allowed.');
        result.isValid = false;
      }

      // Check domain whitelist
      const domain = parsedUrl.hostname.toLowerCase();
      const isAllowedDomain = this.allowedDomains.some(allowedDomain => 
        domain === allowedDomain || domain.endsWith(`.${allowedDomain}`)
      );

      if (!isAllowedDomain) {
        result.errors.push(`Domain not allowed: ${domain}`);
        result.isValid = false;
      }

      // Detect platform
      if (domain.includes('openai.com') || domain.includes('chatgpt.com')) {
        result.platform = 'chatgpt';
      } else if (domain.includes('claude.ai')) {
        result.platform = 'claude';
      } else if (domain.includes('gemini.google.com') || domain.includes('bard.google.com')) {
        result.platform = 'gemini';
      }

      // Check for suspicious patterns
      if (parsedUrl.pathname.includes('..') || parsedUrl.pathname.includes('%2e%2e')) {
        result.errors.push('Path traversal attempt detected');
        result.isValid = false;
      }

      // Check URL length
      if (url.length > 2048) {
        result.warnings.push('URL is very long and may cause issues');
      }

      // Validate share URL patterns
      const sharePatterns = {
        chatgpt: /\/share\/[a-f0-9-]+/i,
        claude: /\/share\/[a-f0-9-]+/i,
        gemini: /\/share\/[a-f0-9-]+/i,
      };

      if (result.platform !== 'unknown') {
        const pattern = sharePatterns[result.platform as keyof typeof sharePatterns];
        if (pattern && !pattern.test(parsedUrl.pathname)) {
          result.warnings.push(`URL doesn't match expected ${result.platform} share pattern`);
        }
      }

    } catch (error) {
      result.errors.push('Invalid URL format');
      result.isValid = false;
    }

    return result;
  }

  private async generatePdfInternal(
    url: string,
    recordId: string,
    options: {
      addWatermark: boolean;
      format: string;
      quality: string;
      timeout: number;
      platform: string;
    }
  ): Promise<{ size: number; downloadUrl: string; fileName: string }> {
    const browser = await this.launchBrowser();
    
    try {
      const page = await browser.newPage();
      
      // Configure page
      await this.configurePage(page, options.timeout);
      
      // Navigate to URL
      await this.navigateToPage(page, url, options.platform);
      
      // Clean up page content
      await this.cleanupPageContent(page, options.platform);
      
      // Add watermark if needed
      if (options.addWatermark) {
        await this.addWatermark(page);
      }
      
      // Generate PDF
      const pdf = await this.generatePdfBuffer(page, options.format, options.quality);
      
      // Validate file size
      if (pdf.length > this.maxFileSize) {
        throw new Error(`Generated PDF exceeds maximum size limit (${this.maxFileSize / 1024 / 1024}MB)`);
      }
      
      // Save file
      const fileName = `pdf-${recordId}-${nanoid(8)}.pdf`;
      const filePath = await this.savePdfFile(pdf, fileName);
      
      return {
        size: pdf.length,
        downloadUrl: `/api/download-pdf/${recordId}`,
        fileName,
      };

    } finally {
      await browser.close();
    }
  }

  private async launchBrowser(): Promise<puppeteer.Browser> {
    const executablePath = await this.findChrome();
    
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      timeout: 120000,
      protocolTimeout: 120000,
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
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--allow-running-insecure-content',
        '--disable-blink-features=AutomationControlled',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio',
        '--no-pings',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-domain-reliability',
        // Security flags
        '--disable-plugins',
        '--disable-java',
        '--disable-flash',
        '--disable-webgl',
        '--disable-3d-apis',
      ]
    });

    console.log('✅ Browser launched successfully');
    return browser;
  }

  private async findChrome(): Promise<string> {
    const chromePaths = [
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      'chromium-browser',
      'chromium',
      'google-chrome',
      'chrome',
      // Windows paths
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      // macOS paths
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    
    for (const chromePath of chromePaths) {
      try {
        await fs.access(chromePath);
        console.log(`Found Chrome at: ${chromePath}`);
        return chromePath;
      } catch {
        continue;
      }
    }
    
    console.warn('Chrome not found, using default path');
    return chromePaths[0];
  }

  private async configurePage(page: puppeteer.Page, timeout: number): Promise<void> {
    await page.setDefaultTimeout(timeout);
    await page.setDefaultNavigationTimeout(timeout);
    await page.setViewport({ width: 1200, height: 800 });
    
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Block unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block ads, analytics, and unnecessary resources
      if (
        resourceType === 'image' && !url.includes('avatar') ||
        resourceType === 'font' ||
        resourceType === 'media' ||
        url.includes('analytics') ||
        url.includes('google-analytics') ||
        url.includes('googlesyndication') ||
        url.includes('doubleclick') ||
        url.includes('facebook.com') ||
        url.includes('twitter.com')
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  private async navigateToPage(page: puppeteer.Page, url: string, platform: string): Promise<void> {
    console.log(`🌐 Navigating to: ${url}`);
    
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      
      // Platform-specific wait conditions
      const waitSelectors = {
        chatgpt: '[data-message-id], .text-base',
        claude: 'div[data-testid="conversation-container"], .font-claude-message',
        gemini: 'article, .conversation-container',
        unknown: 'body',
      };
      
      const selector = waitSelectors[platform as keyof typeof waitSelectors] || waitSelectors.unknown;
      
      try {
        await page.waitForSelector(selector, { timeout: 30000 });
        console.log(`✅ Content loaded for platform: ${platform}`);
      } catch (error) {
        console.warn(`⚠️ Selector wait timeout for ${platform}, proceeding anyway`);
      }
      
      // Additional wait for content to stabilize
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.error(`❌ Navigation failed for ${url}:`, error);
      throw new Error(`Failed to load page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cleanupPageContent(page: puppeteer.Page, platform: string): Promise<void> {
    console.log('🧹 Cleaning up page content...');
    
    await page.evaluate((platformType) => {
      // Remove common UI elements
      const selectorsToRemove = [
        // Common elements
        'button:contains("Copy")',
        'button:contains("Share")',
        'button:contains("Regenerate")',
        'nav',
        'header',
        'footer',
        '.sticky',
        '[class*="sticky"]',
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
        'noscript',
        '.ad',
        '[class*="ad-"]',
        '[id*="ad-"]',
        
        // Platform-specific elements
        ...(platformType === 'chatgpt' ? [
          '[data-testid="conversation-turn-share-button"]',
          '.text-token-text-quaternary',
          '.group\\/conversation-turn',
        ] : []),
        
        ...(platformType === 'claude' ? [
          '[data-testid="copy-button"]',
          '.cursor-pointer',
          '.hover\\:bg-bg-300',
        ] : []),
        
        ...(platformType === 'gemini' ? [
          '.action-button',
          '.share-button',
          '.copy-button',
        ] : []),
      ];

      // Remove elements
      selectorsToRemove.forEach(selector => {
        try {
          if (selector.includes(':contains(')) {
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

      // Clean up styles and positioning
      document.querySelectorAll('*').forEach(el => {
        const element = el as HTMLElement;
        if (element.style) {
          // Remove fixed/sticky positioning
          if (['fixed', 'sticky'].includes(element.style.position)) {
            element.style.position = 'static';
          }
          // Remove transforms that might cause issues
          element.style.transform = '';
          element.style.transformOrigin = '';
          // Remove animations
          element.style.animation = '';
          element.style.transition = '';
        }
      });

      // Ensure good contrast for printing
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#000000';
    }, platform);
  }

  private async addWatermark(page: puppeteer.Page): Promise<void> {
    console.log('🏷️ Adding watermark...');
    
    await page.evaluate(() => {
      const watermark = document.createElement('div');
      watermark.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 72px;
        color: rgba(200, 200, 200, 0.3);
        font-weight: bold;
        font-family: Arial, sans-serif;
        pointer-events: none;
        z-index: 9999;
        user-select: none;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
      `;
      watermark.textContent = 'CHAT TRANSCRIPT CONVERTER';
      document.body.appendChild(watermark);
    });
  }

  private async generatePdfBuffer(
    page: puppeteer.Page,
    format: string,
    quality: string
  ): Promise<Buffer> {
    console.log('📄 Generating PDF buffer...');
    
    const qualitySettings = {
      high: { printBackground: true, preferCSSPageSize: true },
      medium: { printBackground: true, preferCSSPageSize: false },
      low: { printBackground: false, preferCSSPageSize: false },
    };
    
    const settings = qualitySettings[quality as keyof typeof qualitySettings] || qualitySettings.high;
    
    const pdf = await page.pdf({
      format: format as any,
      ...settings,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px',
      },
      timeout: 60000,
    });
    
    console.log(`✅ PDF buffer generated: ${pdf.length} bytes`);
    return pdf;
  }

  private async savePdfFile(pdfBuffer: Buffer, fileName: string): Promise<string> {
    const filePath = path.join(appConfig.storagePath, fileName);
    
    // Ensure storage directory exists
    await fs.mkdir(appConfig.storagePath, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, pdfBuffer);
    
    console.log(`💾 PDF saved: ${filePath}`);
    return filePath;
  }

  // File management
  async cleanupExpiredFiles(): Promise<{ deletedCount: number; freedSpace: number }> {
    let deletedCount = 0;
    let freedSpace = 0;
    
    try {
      const files = await fs.readdir(appConfig.storagePath);
      const now = Date.now();
      
      for (const file of files) {
        if (!file.endsWith('.pdf')) continue;
        
        const filePath = path.join(appConfig.storagePath, file);
        
        try {
          const stats = await fs.stat(filePath);
          const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
          
          // Delete files older than 48 hours
          if (ageHours > 48) {
            freedSpace += stats.size;
            await fs.unlink(filePath);
            deletedCount++;
            console.log(`🗑️ Deleted expired file: ${file}`);
          }
        } catch (error) {
          console.error(`❌ Error processing file ${file}:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
    
    console.log(`🧹 Cleanup completed: ${deletedCount} files deleted, ${Math.round(freedSpace / 1024 / 1024)}MB freed`);
    return { deletedCount, freedSpace };
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
  }> {
    let totalFiles = 0;
    let totalSize = 0;
    let oldestFile: Date | null = null;
    let newestFile: Date | null = null;
    
    try {
      const files = await fs.readdir(appConfig.storagePath);
      
      for (const file of files) {
        if (!file.endsWith('.pdf')) continue;
        
        const filePath = path.join(appConfig.storagePath, file);
        
        try {
          const stats = await fs.stat(filePath);
          totalFiles++;
          totalSize += stats.size;
          
          if (!oldestFile || stats.mtime < oldestFile) {
            oldestFile = stats.mtime;
          }
          
          if (!newestFile || stats.mtime > newestFile) {
            newestFile = stats.mtime;
          }
        } catch (error) {
          console.error(`❌ Error reading file stats for ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error reading storage directory:', error);
    }
    
    return { totalFiles, totalSize, oldestFile, newestFile };
  }

  getActiveGenerations(): Array<{ recordId: string; startTime: number; url: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeGenerations.entries()).map(([recordId, data]) => ({
      recordId,
      startTime: data.startTime,
      url: data.url,
      duration: now - data.startTime,
    }));
  }
}

export const pdfService = new PdfService();