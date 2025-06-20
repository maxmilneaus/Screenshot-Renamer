#!/usr/bin/env node

const FolderWatcher = require('./folder-watcher');
const config = require('./config');
const geminiAnalyzer = require('./gemini-vision');
const clipboardManager = require('./clipboard-manager');

class ScreenshotRenamer {
  constructor() {
    this.watcher = new FolderWatcher();
    this.isRunning = false;
  }

  async start() {
    console.log('Screenshot Renamer starting...');
    
    // Load and validate configuration
    const currentConfig = config.load();
    const validationErrors = config.validate(currentConfig);
    
    if (validationErrors.length > 0) {
      console.error('Configuration errors:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      console.error('Please run setup first: npm run setup');
      process.exit(1);
    }

    // Test API connection
    console.log('Testing Gemini API connection...');
    const apiTest = await geminiAnalyzer.testConnection();
    if (!apiTest.success) {
      console.error('Gemini API test failed:', apiTest.error);
      console.error('Please check your API key configuration');
      process.exit(1);
    }
    console.log('✓ Gemini API connection successful');

    // Test clipboard functionality
    console.log('Testing clipboard functionality...');
    const clipboardTest = await clipboardManager.testClipboard();
    if (!clipboardTest.success) {
      console.warn('⚠ Clipboard test failed:', clipboardTest.error);
      console.warn('Image copying may not work properly');
    } else {
      console.log('✓ Clipboard functionality working');
    }

    // Start file watcher
    this.watcher.start();
    this.isRunning = true;

    console.log(`✓ Screenshot Renamer is running`);
    console.log(`  Watching: ${currentConfig.watchFolder}`);
    console.log(`  Clipboard copy: ${currentConfig.copyToClipboard ? 'enabled' : 'disabled'}`);
    console.log(`  Notifications: ${currentConfig.showNotifications ? 'enabled' : 'disabled'}`);
    console.log('Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (this.isRunning) {
      console.log('\nShutting down Screenshot Renamer...');
      this.watcher.stop(); 
      this.isRunning = false;
      console.log('✓ Screenshot Renamer stopped');
      process.exit(0);
    }
  }

  async status() {
    const currentConfig = config.load();
    const validationErrors = config.validate(currentConfig);
    
    console.log('Screenshot Renamer Status:');
    console.log('========================');
    console.log(`Watch Folder: ${currentConfig.watchFolder}`);
    console.log(`API Key: ${currentConfig.geminiApiKey ? '✓ Configured' : '✗ Not configured'}`);
    console.log(`Clipboard Copy: ${currentConfig.copyToClipboard ? 'Enabled' : 'Disabled'}`);
    console.log(`Notifications: ${currentConfig.showNotifications ? 'Enabled' : 'Disabled'}`);
    
    if (validationErrors.length > 0) {
      console.log('\nConfiguration Issues:');
      validationErrors.forEach(error => console.log(`  ✗ ${error}`));
    } else {
      console.log('\n✓ Configuration is valid');
    }

    // Test API if configured
    if (currentConfig.geminiApiKey) {
      console.log('\nTesting API connection...');
      const apiTest = await geminiAnalyzer.testConnection();
      console.log(`API Status: ${apiTest.success ? '✓ Working' : '✗ ' + apiTest.error}`);
    }
  }
}

// Handle command line usage
if (require.main === module) {
  const renamer = new ScreenshotRenamer();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case '--status':
    case 'status':
      renamer.status();
      break;
    case '--dev':
    case 'dev':
      console.log('Running in development mode...');
      renamer.start();
      break;
    default:
      renamer.start();
      break;
  }
}

module.exports = ScreenshotRenamer;