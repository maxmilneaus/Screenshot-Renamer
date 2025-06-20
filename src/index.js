#!/usr/bin/env node

const FolderWatcher = require('./folder-watcher');
const config = require('./config');
const geminiAnalyzer = require('./gemini-vision');
const clipboardManager = require('./clipboard-manager');
const Welcome = require('./welcome');
const logger = require('./logger');

class ScreenshotRenamer {
  constructor() {
    this.watcher = new FolderWatcher();
    this.isRunning = false;
  }

  async start() {
    logger.serviceEvent('starting');
    
    // Load and validate configuration
    const currentConfig = config.load();
    const validation = config.validate(currentConfig);
    
    if (!validation.valid) {
      Welcome.showError('Configuration errors detected:', validation.errors);
      Welcome.showConfigHelp();
      logger.error('Service failed to start due to configuration errors', null, { errors: validation.errors });
      process.exit(1);
    }

    // Test API connection
    logger.info('Testing Gemini API connection...');
    const apiTest = await geminiAnalyzer.testConnection();
    if (!apiTest.success) {
      Welcome.showError('Gemini API test failed', [
        'Check your API key is correct',
        'Ensure you have internet connection',
        'Run setup again: npm run setup'
      ]);
      logger.apiError('connection_test', apiTest.error);
      process.exit(1);
    }
    logger.info('Gemini API connection successful');

    // Test clipboard functionality
    logger.info('Testing clipboard functionality...');
    const clipboardTest = await clipboardManager.testClipboard();
    if (!clipboardTest.success) {
      logger.warn('Clipboard test failed, image copying may not work properly', clipboardTest.error);
    } else {
      logger.info('Clipboard functionality working');
    }

    // Start file watcher
    this.watcher.start();
    this.isRunning = true;

    // Show status in development mode, log in production
    if (process.env.NODE_ENV !== 'production') {
      Welcome.showStatus(currentConfig, true);
      console.log('🍳 Ready to sizzle! Add images to your folder to see the magic!\n');
      console.log('Press Ctrl+C to stop');
    }
    
    logger.serviceEvent('started', {
      watchFolder: currentConfig.watchFolder,
      clipboardEnabled: currentConfig.copyToClipboard,
      notificationsEnabled: currentConfig.showNotifications
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (this.isRunning) {
      logger.serviceEvent('stopping');
      this.watcher.stop(); 
      this.isRunning = false;
      logger.serviceEvent('stopped');
      process.exit(0);
    }
  }

  async status() {
    const currentConfig = config.load();
    const validation = config.validate(currentConfig);
    
    // Show welcome and current status
    Welcome.show();
    
    // Check if service is running
    const { execSync } = require('child_process');
    let isServiceRunning = false;
    try {
      execSync('launchctl list | grep screenshot-renamer', { stdio: 'pipe' });
      isServiceRunning = true;
    } catch (error) {
      isServiceRunning = false;
    }
    
    Welcome.showStatus(currentConfig, isServiceRunning);
    
    if (!validation.valid) {
      Welcome.showError('Configuration Issues Found:', validation.errors);
      Welcome.showConfigHelp();
    } else {
      console.log('✅ Configuration is valid');
    }

    // Test API if configured
    if (currentConfig.geminiApiKey) {
      console.log('\n🧪 Testing API connection...');
      const apiTest = await geminiAnalyzer.testConnection();
      if (apiTest.success) {
        console.log('✅ API Status: Working perfectly!');
      } else {
        Welcome.showError('API connection failed', [
          'Check your internet connection',
          'Verify your API key is still valid',
          'Run setup again: npm run setup'
        ]);
      }
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