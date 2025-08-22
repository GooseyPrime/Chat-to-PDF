# PowerShell Deployment Verification Script for Railway
# This script checks if the deployment is working correctly on Windows

Write-Host "🚀 Railway Deployment Verification (Windows PowerShell)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Check if required tools are installed
Write-Host "🔧 Checking required tools..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}

# Check git
try {
    $gitVersion = git --version
    Write-Host "✅ Git version: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git not found. Please install from https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# Check Railway CLI
try {
    $railwayVersion = railway --version
    Write-Host "✅ Railway CLI version: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway CLI not found. Install with: npm install -g @railway/cli" -ForegroundColor Red
    exit 1
}

# Check if we're in the project directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

Write-Host "✅ All required tools are installed" -ForegroundColor Green

# Check if Puppeteer skip environment variable is set
Write-Host "🔧 Checking Puppeteer configuration..." -ForegroundColor Yellow
if ($env:PUPPETEER_SKIP_DOWNLOAD -eq "true") {
    Write-Host "✅ PUPPETEER_SKIP_DOWNLOAD is set" -ForegroundColor Green
} else {
    Write-Host "⚠️  Setting PUPPETEER_SKIP_DOWNLOAD=true" -ForegroundColor Yellow
    $env:PUPPETEER_SKIP_DOWNLOAD = "true"
}

# Build the application
Write-Host "🔨 Building application..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ Build successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Check if essential files exist
Write-Host "📁 Checking build artifacts..." -ForegroundColor Yellow

if (Test-Path "dist\index.js") {
    Write-Host "✅ Server build found (dist\index.js)" -ForegroundColor Green
} else {
    Write-Host "❌ Server build not found (dist\index.js)" -ForegroundColor Red
    exit 1
}

if (Test-Path "dist\public\index.html") {
    Write-Host "✅ Client build found (dist\public\index.html)" -ForegroundColor Green
} else {
    Write-Host "❌ Client build not found (dist\public\index.html)" -ForegroundColor Red
    exit 1
}

if (Test-Path "dist\index.html") {
    Write-Host "✅ Root index.html found (dist\index.html)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Root index.html not found, copying from public..." -ForegroundColor Yellow
    Copy-Item "dist\public\index.html" "dist\index.html"
    Write-Host "✅ index.html copied to dist root" -ForegroundColor Green
}

# Check Railway configuration files
Write-Host "📋 Checking Railway configuration..." -ForegroundColor Yellow

if (Test-Path "railway.json") {
    Write-Host "✅ railway.json found" -ForegroundColor Green
} else {
    Write-Host "❌ railway.json not found" -ForegroundColor Red
    exit 1
}

if (Test-Path ".npmrc") {
    $npmrcContent = Get-Content ".npmrc"
    if ($npmrcContent -contains "puppeteer_skip_download=true") {
        Write-Host "✅ .npmrc configured for Puppeteer skip" -ForegroundColor Green
    } else {
        Write-Host "⚠️  .npmrc missing Puppeteer skip configuration" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  .npmrc not found" -ForegroundColor Yellow
}

# Check essential source files
Write-Host "📁 Checking source files..." -ForegroundColor Yellow

$requiredFiles = @(
    "package.json",
    "server\index.ts",
    "client\src\main.tsx"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file found" -ForegroundColor Green
    } else {
        Write-Host "❌ $file not found" -ForegroundColor Red
        exit 1
    }
}

# Success message
Write-Host ""
Write-Host "🎉 All verification checks passed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Set up your environment variables (see RAILWAY_ENVIRONMENT_SETUP.md)" -ForegroundColor White
Write-Host "2. Run: railway login" -ForegroundColor White
Write-Host "3. Run: railway init" -ForegroundColor White
Write-Host "4. Add environment variables in Railway dashboard" -ForegroundColor White
Write-Host "5. Run: railway up" -ForegroundColor White
Write-Host ""
Write-Host "📚 For detailed instructions, see README.md" -ForegroundColor Cyan