#!/usr/bin/env node

const FolderWatcher = require('./folder-watcher');
const config = require('./config');
const AnalyzerFactory = require('./analyzers/analyzer-factory');
const clipboardManager = require('./clipboard-manager');
const Welcome = require('./welcome');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ScreenshotRenamer {
  constructor() {
    this.watcher = new FolderWatcher();
    this.isRunning = false;
    this.pidFilePath = path.join(os.tmpdir(), 'screenshot-renamer.pid');
  }

  getAnalyzer() {
    const currentConfig = config.load();
    return AnalyzerFactory.createAnalyzer(currentConfig);
  }

  async start() {
    logger.serviceEvent('starting');
    
    // Load and validate configuration
    const currentConfig = config.load();
    logger.info('Configuration loaded for service', { config: currentConfig });
    const validation = config.validate(currentConfig);
    
    if (!validation.valid) {
      Welcome.showError('Configuration errors detected:', validation.errors);
      Welcome.showConfigHelp();
      logger.error('Service failed to start due to configuration errors', null, { errors: validation.errors });
      process.exit(1);
    }

    // Test API connection
    const analyzer = this.getAnalyzer();
    const provider = currentConfig.aiProvider;
    logger.info(`Testing ${provider} API connection...`);
    const apiTest = await analyzer.testConnection();
    if (!apiTest.success) {
      Welcome.showError(`${provider} API test failed`, [
        provider === 'gemini' ? 'Check your API key is correct' : 'Check LM Studio is running',
        provider === 'gemini' ? 'Ensure you have internet connection' : 'Verify LM Studio endpoint is accessible',
        'Run setup again: npm run setup'
      ]);
      logger.apiError('connection_test', apiTest.error);
      process.exit(1);
    }
    logger.info(`${provider} API connection successful`);

    // Test clipboard functionality
    logger.info('Testing clipboard functionality...');
    const clipboardTest = await clipboardManager.testClipboard();
    if (!clipboardTest.success) {
      logger.warn('Clipboard test failed, image copying may not work properly', clipboardTest.error);
    } else {
      logger.info('Clipboard functionality working');
    }

    // Create PID file
    this.createPidFile();

    // Start file watcher
    this.watcher.start();
    this.isRunning = true;

    // Show status in development mode, log in production
    if (process.env.NODE_ENV !== 'production') {
      Welcome.showStatus(currentConfig, true);
      console.log('The utility is now observing. Introduce images to your folder to witness the transformation.\n');
      console.log('To pause observation, press Ctrl+C.');
    }
    
    logger.serviceEvent('started', {
      watchFolder: currentConfig.watchFolder,
      clipboardEnabled: currentConfig.copyToClipboard
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    
    // Handle config reload (SIGUSR1)
    process.on('SIGUSR1', () => {
      logger.info('🔄 Received reload signal, updating configuration...');
      this.watcher.reloadConfig();
      logger.info('✅ Configuration reloaded');
    });
  }

  stop() {
    if (this.isRunning) {
      logger.serviceEvent('stopping');
      this.watcher.stop();
      this.isRunning = false;
      this.removePidFile(); // Remove PID file on graceful shutdown
      logger.serviceEvent('stopped');
      process.exit(0);
    }
  }

  createPidFile() {
    try {
      fs.writeFileSync(this.pidFilePath, process.pid.toString());
      logger.debug(`PID file created at: ${this.pidFilePath}`);
    } catch (error) {
      logger.error(`Failed to create PID file: ${error.message}`);
    }
  }

  removePidFile() {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
        logger.debug(`PID file removed from: ${this.pidFilePath}`);
      }
    } catch (error) {
      logger.error(`Failed to remove PID file: ${error.message}`);
    }
  }

  isServiceRunning() {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        const pid = fs.readFileSync(this.pidFilePath, 'utf8');
        // Check if a process with this PID is actually running
        process.kill(parseInt(pid), 0); // Signal 0 checks if process exists
        return true;
      }
    } catch (error) {
      // Process does not exist or permission denied
    }
    return false;
  }

  async status() {
    const currentConfig = config.load();
    const validation = config.validate(currentConfig);
    
    // Show welcome and current status
    Welcome.show();
    
    // Check if service is running using PID file
    const isRunning = this.isServiceRunning();
    
    Welcome.showStatus(currentConfig, isRunning);
    
    if (!validation.valid) {
      Welcome.showError('Configuration Issues Found:', validation.errors);
      Welcome.showConfigHelp();
    } else {
      console.log('✅ Configuration is valid');
    }

    // Test API if configured
    const provider = currentConfig.aiProvider;
    const hasValidConfig = provider === 'gemini' ? currentConfig.geminiApiKey :
                          provider === 'lmstudio' ? currentConfig.lmstudioBaseUrl : false;
    
    if (hasValidConfig) {
      console.log(`\n🧪 Testing the ${provider} connection...`);
      const analyzer = this.getAnalyzer();
      const apiTest = await analyzer.testConnection();
      if (apiTest.success) {
        console.log('✅ Connection Status: Operating as intended.');
      } else {
        Welcome.showError('Connection to AI companion failed', [
          provider === 'gemini' ? 'Verify your internet connection' : 'Confirm LM Studio is active',
          provider === 'gemini' ? 'Ensure your API key remains valid' : 'Verify the LM Studio endpoint is accessible',
          'Consider re-running the setup: npm run setup'
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
      console.log('Operating in development mode...');
      renamer.start();
      break;
    default:
      renamer.start();
      break;
  }
}

module.exports = ScreenshotRenamer;