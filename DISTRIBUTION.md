# Distribution Guide - Screenshot Renamer

This guide explains how to package and distribute the Screenshot Renamer for others to use.

## 📦 Distribution Options

### Option 1: GitHub Repository (Recommended)
```bash
# Users clone and install
git clone <your-repo-url>
cd screenshot-renamer
npm install
npm run setup -- --api-key "THEIR_API_KEY"
npm run install-service
```

### Option 2: npm Package
```bash
# Publish to npm
npm publish

# Users install globally
npm install -g screenshot-renamer
screenshot-renamer setup --api-key "THEIR_API_KEY"
```

### Option 3: Standalone Installer
Create a setup script that handles everything automatically.

## 🛠️ Setup Methods for End Users

The app now supports multiple setup methods to work in any environment:

### 1. Interactive Setup (Best UX)
```bash
npm run setup
```
- Works in proper terminal environments
- Guided prompts for all settings
- Automatic fallback if interactive mode fails

### 2. Command Line Setup (Universal)
```bash
npm run setup -- --api-key "YOUR_KEY" --folder "/path/to/folder"
```
- Works in any environment (CI, scripts, etc.)
- No interactive prompts required
- Perfect for automated installations

### 3. Simple Configuration (Fastest)
```bash
node configure.js YOUR_API_KEY
```
- Single command with API key
- Uses sensible defaults
- Quickest way to get started

## 📋 User Instructions Template

Include this in your distribution:

```markdown
# Quick Start for Screenshot Renamer

## 1. Get a Google Gemini API Key
Visit: https://makersuite.google.com/app/apikey

## 2. Install Dependencies
npm install

## 3. Configure (choose one method):

**Method A - Interactive:**
npm run setup

**Method B - Command Line:**
npm run setup -- --api-key "YOUR_KEY" --folder "/path/to/folder"

**Method C - Quick Config:**
node configure.js YOUR_API_KEY

## 4. Install as Background Service
npm run install-service

## 5. Test It!
Add an image to your configured folder and watch it get renamed!
```

## 🔧 Environment Compatibility

The setup now handles:
- ✅ **Terminal/TTY environments** - Full interactive experience
- ✅ **Non-TTY environments** - Automatic fallback to command-line mode
- ✅ **CI/CD environments** - Works with command-line arguments
- ✅ **Remote SSH sessions** - Adapts to available capabilities
- ✅ **Various shells** - bash, zsh, fish, etc.

## 🚀 Installation Script Example

Create an `install.sh` for easy distribution:

```bash
#!/bin/bash
echo "Screenshot Renamer Installer"
echo "============================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is required. Please install Node.js first."
    exit 1
fi

# Install dependencies
npm install

# Prompt for API key
read -p "Enter your Google Gemini API key: " api_key

if [ -z "$api_key" ]; then
    echo "API key is required"
    exit 1
fi

# Setup with provided key
npm run setup -- --api-key "$api_key"

# Install service
npm run install-service

echo "Installation complete! The service is now running in the background."
```

## 📄 License and Distribution

- MIT License allows free distribution
- Include license file in distributions
- Attribution appreciated but not required

## 🔍 Testing Different Environments

Before distributing, test in:
- [ ] macOS Terminal
- [ ] VS Code integrated terminal  
- [ ] SSH sessions
- [ ] CI/CD environments
- [ ] Different Node.js versions (16+)

## 💡 Support Instructions

For user support, direct them to:
1. Check service status: `launchctl list | grep screenshot-renamer`
2. View logs: `tail -f ~/Library/Logs/screenshot-renamer.log`
3. Test API: `npm run start -- test`
4. Reconfigure: `npm run setup`

The robust setup system ensures users can get the app working regardless of their technical environment!