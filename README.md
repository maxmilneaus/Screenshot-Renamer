# Screenshot Renamer

Automatically rename images using AI analysis and copy them to clipboard. Perfect for organizing screenshots and images with meaningful, descriptive names.

## Features

- 🤖 **AI-Powered Naming**: Uses Google Gemini Vision to analyze images and generate descriptive filenames
- 📋 **Clipboard Integration**: Automatically copies renamed images to clipboard for instant pasting
- 👀 **Folder Monitoring**: Watches any folder for new images and processes them automatically
- 🔄 **Background Service**: Runs silently in the background like CleanMyMac or similar utilities
- 🔧 **Easy Configuration**: Simple setup with configurable options
- 📱 **macOS Optimized**: Built specifically for macOS with native notifications

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up configuration**:
   ```bash
   # Interactive setup (when available)
   npm run setup
   
   # Non-interactive setup with command line arguments
   npm run setup -- --api-key "YOUR_GEMINI_API_KEY" --folder "/path/to/watch"
   
   # Or use the simple configure script
   node configure.js YOUR_GEMINI_API_KEY
   ```

3. **Start the service**:
   ```bash
   npm start
   ```

## Installation

### Prerequisites
- Node.js 16+ 
- macOS (required for clipboard functionality)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Setup Steps

1. **Clone and install**:
   ```bash
   git clone <repository-url>
   cd screenshot-renamer
   npm install
   ```

2. **Run setup**:
   
   **Option A: Interactive Setup** (when running in a terminal)
   ```bash
   npm run setup
   ```
   
   **Option B: Command Line Setup** (works anywhere)
   ```bash
   npm run setup -- --api-key "YOUR_GEMINI_API_KEY" --folder "/path/to/folder"
   ```
   
   **Option C: Simple Configuration** (quickest)
   ```bash
   node configure.js YOUR_GEMINI_API_KEY
   ```
   
   All methods will configure:
   - Folder to monitor (default: Desktop or screenshot location)
   - Google Gemini API key  
   - Clipboard and notification preferences

3. **Test the configuration**:
   ```bash
   npm run start -- test
   ```

## Usage

### Manual Mode
```bash
# Start the service (runs until stopped)
npm start

# Check status and configuration
npm run start -- --status

# Run setup again
npm run setup
```

### Background Service Mode
```bash
# Install as macOS background service (auto-starts on login)
npm run install-service

# Check service status
node scripts/install.js status

# View service logs
node scripts/install.js logs

# Uninstall background service
npm run uninstall-service
```

### Command Line Interface
```bash
# Global installation
npm install -g .

# Then use anywhere
screenshot-renamer start
screenshot-renamer status
screenshot-renamer setup
screenshot-renamer config --folder "/path/to/folder"
screenshot-renamer test
```

## Configuration

Configuration is stored in `~/.screenshot-renamer-config.json`:

```json
{
  "watchFolder": "/Users/username/Desktop",
  "geminiApiKey": "your-api-key-here",
  "copyToClipboard": true,
  "showNotifications": true,
  "logLevel": "info"
}
```

### Configuration Options

- `watchFolder`: Path to monitor for new images
- `geminiApiKey`: Your Google Gemini API key
- `copyToClipboard`: Automatically copy renamed images to clipboard
- `showNotifications`: Show macOS notifications when images are renamed
- `logLevel`: Logging verbosity (info, warn, error)

## How It Works

1. **Monitor**: Watches your specified folder for new image files (PNG, JPG, GIF, WebP)
2. **Analyze**: Uses Google Gemini Vision API to understand image content
3. **Rename**: Generates descriptive filename based on AI analysis
4. **Copy**: Automatically copies the renamed image to your clipboard
5. **Notify**: Shows a brief notification with the new filename

### Example Workflow

1. You take a screenshot → `Screenshot 2024-06-20 at 10.30.15 AM.png`
2. AI analyzes the image → Detects "login screen for mobile app"
3. File gets renamed → `login_screen_mobile_app_1718901015123.png`
4. Image is copied to clipboard → Ready to paste anywhere
5. Notification shows → "Renamed & copied: login_screen_mobile_app_1718901015123.png"

## Supported Formats

- PNG (most common for screenshots)
- JPEG/JPG
- GIF
- WebP

## Folder Suggestions

The setup will auto-detect common folders:
- macOS Screenshot location (usually Desktop)
- Desktop
- Downloads  
- Pictures
- Custom OneDrive/Dropbox paths

## Troubleshooting

### API Issues
```bash
# Test API connection
screenshot-renamer test

# Update API key
screenshot-renamer config --api-key "new-key-here"
```

### Clipboard Issues
- Ensure you're running on macOS
- Check that accessibility permissions are granted if needed
- Test with: `screenshot-renamer test`

### Service Issues
```bash
# Check if service is running
launchctl list | grep screenshot-renamer

# View service logs
tail -f ~/Library/Logs/screenshot-renamer.log

# Restart service
npm run uninstall-service && npm run install-service
```

### Configuration Issues
```bash
# Show current config
screenshot-renamer config --show

# Reset to defaults
rm ~/.screenshot-renamer-config.json
npm run setup
```

## Development

```bash
# Run in development mode with verbose logging
npm run dev

# Run without installing as service
npm start -- --dev
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on macOS
5. Submit a pull request

## API Costs

Google Gemini API has generous free tiers:
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per month

For typical screenshot usage, this should cover hundreds of renames per day at no cost.