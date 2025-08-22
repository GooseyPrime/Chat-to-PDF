#!/bin/bash

# 🚂 Railway Deployment Script for ChatTranscriptConverter
# Run this script to validate and deploy to Railway

set -e  # Exit on error

echo "🚂 ChatTranscriptConverter - Railway Deployment Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}❌ Railway CLI not found${NC}"
        echo "Install it with: npm install -g @railway/cli"
        echo "Or visit: https://railway.app/cli"
        exit 1
    fi
    echo -e "${GREEN}✅ Railway CLI found${NC}"
}

# Check if logged in to Railway
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        echo -e "${YELLOW}⚠️ Not logged in to Railway${NC}"
        echo "Please run: railway login"
        exit 1
    fi
    echo -e "${GREEN}✅ Railway authentication verified${NC}"
}

# Validate required files exist
check_files() {
    local files=(
        "package.json"
        "server/index.ts"
        "server/config/environment.ts"
        "shared/schema.ts"
    )
    
    for file in "${files[@]}"; do
        if [ ! -f "$file" ]; then
            echo -e "${RED}❌ Missing required file: $file${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ All required files present${NC}"
}

# Validate package.json has correct scripts
check_package_json() {
    if ! grep -q '"railway:build"' package.json; then
        echo -e "${RED}❌ Missing railway:build script in package.json${NC}"
        exit 1
    fi
    if ! grep -q '"railway:start"' package.json; then
        echo -e "${RED}❌ Missing railway:start script in package.json${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Package.json scripts validated${NC}"
}

# Check environment variables template
check_env_template() {
    if [ ! -f ".env.example" ] && [ ! -f "railway_environment.env" ]; then
        echo -e "${YELLOW}⚠️ No environment template found${NC}"
        echo "Please ensure you have the environment variables ready"
    else
        echo -e "${GREEN}✅ Environment template found${NC}"
    fi
}

# Git status check
check_git_status() {
    if [ -d ".git" ]; then
        if [ -n "$(git status --porcelain)" ]; then
            echo -e "${YELLOW}⚠️ Uncommitted changes detected${NC}"
            echo "Would you like to commit them? (y/n)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                git add .
                echo "Enter commit message:"
                read -r commit_msg
                git commit -m "$commit_msg"
                echo -e "${GREEN}✅ Changes committed${NC}"
            fi
        else
            echo -e "${GREEN}✅ Git status clean${NC}"
        fi
    else
        echo -e "${RED}❌ No git repository found${NC}"
        echo "Initialize git repository first: git init"
        exit 1
    fi
}

# Create or link Railway project
setup_railway_project() {
    echo -e "${BLUE}🔧 Setting up Railway project...${NC}"
    
    if [ ! -f ".railway/project.json" ]; then
        echo "No existing Railway project found."
        echo "Would you like to create a new project or link existing? (create/link)"
        read -r action
        
        if [[ "$action" == "create" ]]; then
            echo "Enter project name (or press enter for 'chat-transcript-converter'):"
            read -r project_name
            project_name=${project_name:-chat-transcript-converter}
            
            railway project create "$project_name"
            echo -e "${GREEN}✅ Railway project created: $project_name${NC}"
        elif [[ "$action" == "link" ]]; then
            railway link
            echo -e "${GREEN}✅ Railway project linked${NC}"
        else
            echo -e "${RED}❌ Invalid option${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Railway project already linked${NC}"
    fi
}


# Check environment variables
check_environment_variables() {
    echo -e "${BLUE}🔍 Checking environment variables...${NC}"
    
    local required_vars=(
        "STRIPE_SECRET_KEY"
        "STRIPE_WEBHOOK_SECRET"
        "STRIPE_PUBLISHABLE_KEY"
        "FIREBASE_PROJECT_ID"
        "SESSION_SECRET"
        "NODE_ENV"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! railway variables | grep -q "$var"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required environment variables:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo ""
        echo "Please set these variables in Railway dashboard or using CLI:"
        echo "railway variables set VARIABLE_NAME=value"
        echo ""
        echo "See RAILWAY_ENVIRONMENT_SETUP.md for complete list"
        exit 1
    else
        echo -e "${GREEN}✅ All required environment variables set${NC}"
    fi
}



# Deploy to Railway
deploy_to_railway() {
    echo -e "${BLUE}🚀 Deploying to Railway...${NC}"
    
    echo "Ready to deploy? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        railway up
        echo -e "${GREEN}✅ Deployment initiated${NC}"
        echo "Check deployment status: railway status"
        echo "View logs: railway logs"
    fi
}

# Show post-deployment steps
show_post_deployment() {
    echo ""
    echo -e "${GREEN}🎉 Deployment script completed!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "1. Check deployment status: railway status"
    echo "2. View logs: railway logs"
    echo "3. Get app URL: railway domain"
    echo "4. Test health endpoint: curl https://your-app.up.railway.app/api/health"
    echo "5. Set up Stripe webhook with your Railway URL"
    echo "6. Test PDF generation functionality"
    echo ""
    echo "🔗 Useful commands:"
    echo "- railway logs --follow    # Follow logs in real-time"
    echo "- railway shell           # Access container shell"
    echo "- railway variables       # List environment variables"
    echo "- railway service         # Manage services"
    echo ""
    echo "📚 Full documentation: See railway_deployment_guide.md"
}

# Main execution flow
main() {
    echo "Starting deployment validation..."
    echo ""
    
    # Run all checks
    check_railway_cli
    check_railway_auth
    check_files
    check_package_json
    check_env_template
    check_git_status
    
    echo ""
    echo -e "${GREEN}✅ All validation checks passed!${NC}"
    echo ""
    
    # Setup and deploy
    setup_railway_project
    check_environment_variables
    deploy_to_railway
    
    # Show next steps
    show_post_deployment
}

# Handle script arguments
case "${1:-}" in
    "check")
        echo "Running validation checks only..."
        check_railway_cli
        check_railway_auth
        check_files
        check_package_json
        check_env_template
        check_git_status
        echo -e "${GREEN}✅ All checks passed!${NC}"
        ;;
    "deploy")
        echo "Running deployment only..."
        check_railway_cli
        check_railway_auth
        deploy_to_railway
        ;;
    "help"|"--help"|"-h")
        echo "Railway Deployment Script"
        echo ""
        echo "Usage:"
        echo "  ./railway_deploy.sh         # Full deployment process"
        echo "  ./railway_deploy.sh check   # Run validation checks only"
        echo "  ./railway_deploy.sh deploy  # Deploy without checks"
        echo "  ./railway_deploy.sh help    # Show this help"
        echo ""
        ;;
    *)
        main
        ;;
esac