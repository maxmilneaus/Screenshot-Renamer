# 🎯 Batch Renamer - AI-Powered Bulk Image Renaming

A standalone batch processing module for the Screenshot Renamer that enables intelligent bulk renaming of entire folders of images with customizable naming patterns and project-specific prefixes.

## 🚀 Quick Start

### 1. Configure Batch Settings
```bash
npm run batch-setup
```

### 2. Process a Folder
```bash
npm run batch-rename ~/Desktop/screenshots
```

### 3. Preview Changes First
```bash
npm run batch-rename ~/Desktop/screenshots preview
```

## 📋 Features

### **Interactive Setup System**
- 📁 **Folder Selection** - Browse and select target directories
- 🔄 **Processing Modes** - Rename in place, copy to new location, or preview only
- 🏷️ **Project Prefixes** - Add custom prefixes like "myapp_login_screen.png"
- 📝 **Filename Formats** - Multiple naming patterns and separators
- 💾 **Settings Persistence** - Remember preferences between sessions
- 📋 **Templates** - Save and reuse common configurations

### **Smart Processing**
- 🤖 **AI Analysis** - Uses same AI providers as main app (Gemini, LM Studio, Ollama)
- ⏭️ **Skip Processed** - Automatically skip already renamed files
- 🔍 **Preview Mode** - See all changes before applying
- 📊 **Progress Tracking** - Real-time processing statistics
- 🗂️ **File Type Filtering** - Process specific image formats only

### **Flexible Output Options**
- **Rename in place** - Replace original files
- **Copy to new location** - Keep originals, create renamed copies
- **Clipboard integration** - Auto-copy renamed files (optional)

## 🎨 Filename Format Options

### **Available Formats**
1. **`{description}`** → `user_login_screen.png`
2. **`{prefix}_{description}`** → `myapp_user_login_screen.png`
3. **`{prefix}-{description}`** → `myapp-user-login-screen.png`
4. **`{date}_{prefix}_{description}`** → `2024-01-15_myapp_user_login.png`

### **Example Configurations**

#### Web Design Project
```
Prefix: "web"
Format: {prefix}_{description}
Separator: _
Result: web_hero_section.png
```

#### App Screenshots  
```
Prefix: "myapp"
Format: {prefix}-{description}
Separator: -
Result: myapp-dashboard-view.png
```

#### Documentation
```
Prefix: "docs"
Format: {date}_{prefix}_{description}
Separator: _
Result: 2024-01-15_docs_installation_guide.png
```

## 🔧 Command Reference

### **Setup Commands**
```bash
# Interactive configuration
npm run batch-setup

# View current settings (in setup interface)
npm run batch-setup → Configure batch settings
```

### **Processing Commands**
```bash
# Process folder with current settings
npm run batch-rename <folder-path>

# Preview changes without applying
npm run batch-rename <folder-path> preview

# Examples
npm run batch-rename ~/Desktop/screenshots
npm run batch-rename ./images preview
npm run batch-rename "/Users/name/Project Screenshots"
```

## ⚙️ Configuration Options

### **Processing Modes**
- **`rename`** - Rename files in place (replaces originals)
- **`copy`** - Copy renamed files to new location (keeps originals)  
- **`preview`** - Show proposed changes without making them

### **Filename Customization**
- **Prefix** - Project identifier (e.g., "myapp", "web", "docs")
- **Format** - Template for filename structure
- **Separator** - Character between words (`_`, `-`, `.`)

### **Advanced Options**
- **Skip Processed** - Ignore files that appear already renamed
- **File Types** - Which image formats to process (PNG, JPG, GIF, WebP)
- **Clipboard Copy** - Auto-copy renamed files to clipboard
- **Create Backup** - Save original filenames for undo functionality

## 📊 Preview System

The preview mode shows exactly what changes will be made:

```
📊 Batch Preview Summary
══════════════════════════════════════════════════════
📂 Folder: /Users/name/Desktop/screenshots
🔄 Mode: rename
📝 Format: {prefix}_{description}
🏷️  Prefix: myapp
📁 Total files: 15
✅ Will process: 12
⏭️  Will skip: 3

📋 Proposed Changes:
════════════════════════════════════════════════════════════════════════════════
📄 Original Name                    → 📄 New Name                        Status
────────────────────────────────────────────────────────────────────────────────
Screenshot 2024-01-15 at 3.png     → myapp_login_form.png              ✅ Will rename
IMG_1234.jpg                       → myapp_dashboard_view.jpg           ✅ Will rename
image.png                          → myapp_user_profile.png            ✅ Will rename
already_processed_file.png         → already_processed_file.png        ⏭️  Skipped
```

## 🎯 Templates System

### **Built-in Templates**
- **Web Design** - `web_{description}` with underscore separator
- **App Screenshots** - `app-{description}` with dash separator  
- **Documentation** - `{date}_docs_{description}` with date prefix

### **Creating Custom Templates**
1. Configure your preferred settings in setup
2. Choose "Save current as template"
3. Give it a memorable name
4. Reuse anytime via "Use template"

### **Template Configuration**
Templates save:
- Prefix settings
- Filename format
- Separator character

## 🔄 Workflow Examples

### **Quick Rename Workflow**
```bash
# 1. Set up once
npm run batch-setup

# 2. Process folders as needed
npm run batch-rename ~/Desktop/new-screenshots
npm run batch-rename ~/Documents/app-images
```

### **Project-Specific Workflow**  
```bash
# 1. Configure for current project
npm run batch-setup
# → Set prefix to "ecommerce"
# → Choose format: {prefix}_{description}

# 2. Process project screenshots
npm run batch-rename ./design-assets/screenshots

# Result: login_page.png → ecommerce_login_page.png
```

### **Safe Preview Workflow**
```bash
# 1. Always preview first
npm run batch-rename ./images preview

# 2. Review the proposed changes

# 3. Execute if satisfied
npm run batch-rename ./images
```

## 📁 File Organization

### **Settings Location**
Batch settings are stored independently at:
```
~/.screenshot-renamer-batch-settings.json
```

### **Settings Structure**
```json
{
  "lastUsedFolder": "/Users/name/Desktop",
  "defaultPrefix": "myapp",
  "filenameFormat": "{prefix}_{description}",
  "separator": "_",
  "processMode": "rename",
  "copyDestination": "",
  "skipProcessed": true,
  "copyToClipboard": false,
  "createBackup": true,
  "fileTypes": ["png", "jpg", "jpeg", "gif", "webp"],
  "templates": {
    "Web Project": {
      "prefix": "web",
      "format": "{prefix}_{description}",
      "separator": "_"
    }
  }
}
```

## 🛡️ Safety Features

### **Conflict Resolution**
- Automatically handles filename conflicts by adding numbers
- Example: `login_form.png`, `login_form_2.png`, `login_form_3.png`

### **Backup & Undo**
- Optional backup of original filenames
- Undo functionality (planned feature)

### **Validation**
- Checks folder existence before processing
- Validates settings before execution
- Tests AI API connection before starting

## 🚨 Troubleshooting

### **Common Issues**

#### "Configuration errors" 
- Run `npm run setup` to configure main AI provider first
- Batch renamer uses the main app's AI configuration

#### "No image files found"
- Check file types in batch settings
- Ensure folder contains supported formats (PNG, JPG, GIF, WebP)

#### "Copy destination does not exist"
- Create destination folder manually, or
- Choose "rename" mode instead of "copy" mode

#### Preview shows no changes
- Files may already be processed (have AI-generated names)
- Disable "Skip Processed" in settings if needed

### **Reset Settings**
```bash
npm run batch-setup
# → Choose "Reset to defaults"
```

## 🔗 Integration

### **Main App Compatibility**
- Uses same AI providers (Gemini, LM Studio, Ollama)
- Shares main configuration for AI settings
- Independent batch-specific settings
- Can be used alongside the main folder watcher

### **Standalone Operation**
- Works completely independently 
- Own CLI commands and configuration
- Separate settings file
- No conflicts with main app usage

## 📈 Performance

### **Optimizations**
- Processes files sequentially to avoid overwhelming AI APIs
- Built-in file stability checking
- Efficient preview generation with mock analysis
- Progress tracking and timing statistics

### **Expected Processing Times**
- **Local AI (LM Studio)**: ~2-5 seconds per image
- **Cloud AI (Gemini)**: ~1-3 seconds per image  
- **Preview Mode**: ~50ms per image (no AI analysis)

---

## 🎉 Success Stories

Transform your image organization workflow:

**Before:**
```
Screenshot 2024-01-15 at 3.27.45 PM.png
IMG_1234.jpg
Image.png
Untitled.png
```

**After (with prefix "ecommerce"):**
```
ecommerce_product_grid_layout.png
ecommerce_shopping_cart_interface.jpg
ecommerce_user_account_settings.png
ecommerce_checkout_payment_form.png
```

Start organizing your images intelligently with AI-powered batch renaming! 🚀