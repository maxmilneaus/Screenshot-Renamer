#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');
const geminiAnalyzer = require('./gemini-vision');
const Welcome = require('./welcome');

class Setup {
  constructor() {
    this.isInteractive = this.checkInteractiveCapability();
  }

  checkInteractiveCapability() {
    // Check if we're in a proper interactive terminal
    return process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;
  }

  async run() {
    // Show welcome page
    Welcome.show();
    Welcome.showQuickStart();

    if (!this.isInteractive) {
      console.log('⚠️  Non-interactive environment detected.');
      console.log('Using command-line arguments or defaults.\n');
      return this.runNonInteractive();
    }

    console.log('\n🔧 Starting interactive setup...\n');

    try {
      const currentConfig = config.load();
      
      // Show current settings first
      console.log('Current settings:');
      console.log(`  Watch Folder: ${currentConfig.watchFolder}`);
      console.log(`  API Key: ${currentConfig.geminiApiKey ? '✓ Configured' : '✗ Not set'}`);
      console.log(`  Clipboard Copy: ${currentConfig.copyToClipboard}`);
      console.log(`  Notifications: ${currentConfig.showNotifications}\n`);

      const answers = await this.promptWithFallback([
        {
          type: 'input',
          name: 'watchFolder',
          message: 'Enter the folder path to watch for images:',
          default: currentConfig.watchFolder,
          validate: (input) => {
            if (!input.trim()) return 'Folder path is required';
            if (!fs.existsSync(input.trim())) {
              return 'Folder does not exist. Please enter a valid path.';
            }
            return true;
          }
        },
        {
          type: 'password',
          name: 'geminiApiKey',
          message: 'Enter your Google Gemini API key:',
          default: currentConfig.geminiApiKey,
          validate: (input) => {
            if (!input.trim()) return 'API key is required';
            return true;
          }
        },
        {
          type: 'confirm',
          name: 'copyToClipboard',
          message: 'Copy renamed images to clipboard automatically?',
          default: currentConfig.copyToClipboard
        },
        {
          type: 'confirm',
          name: 'showNotifications',
          message: 'Show notifications when images are renamed?',
          default: currentConfig.showNotifications
        }
      ]);

      return this.completeSetup(answers);

    } catch (error) {
      if (error.isTtyError || error.code === 'ERR_USE_AFTER_CLOSE') {
        console.log('⚠️  Interactive prompts failed, falling back to non-interactive mode');
        return this.runNonInteractive();
      } else {
        console.error('Setup failed:', error.message);
        process.exit(1);
      }
    }
  }

  async promptWithFallback(questions) {
    try {
      return await inquirer.prompt(questions);
    } catch (error) {
      if (error.code === 'ERR_USE_AFTER_CLOSE') {
        throw new Error('Interactive prompts not available');
      }
      throw error;
    }
  }

  async runNonInteractive() {
    const args = process.argv.slice(2);
    const currentConfig = config.load();
    
    // Parse command line arguments
    const answers = {
      watchFolder: this.getArgValue('--folder') || currentConfig.watchFolder,
      geminiApiKey: this.getArgValue('--api-key') || currentConfig.geminiApiKey,
      copyToClipboard: this.getBooleanArg('--clipboard', currentConfig.copyToClipboard),
      showNotifications: this.getBooleanArg('--notifications', currentConfig.showNotifications)
    };

    // If no API key provided, show instructions
    if (!answers.geminiApiKey) {
      console.log('🔑 Google Gemini API Key Required');
      console.log('================================');
      console.log('1. Visit: https://makersuite.google.com/app/apikey');
      console.log('2. Create an API key');
      console.log('3. Run setup again with: npm run setup -- --api-key YOUR_KEY');
      console.log('\nOr use the configure script:');
      console.log('node configure.js YOUR_API_KEY');
      console.log('\nExample:');
      console.log('npm run setup -- --api-key AIzaSyB... --folder "/path/to/folder"');
      
      // Save partial config
      if (answers.watchFolder !== currentConfig.watchFolder) {
        config.update({ watchFolder: answers.watchFolder });
        console.log(`\n✓ Watch folder updated: ${answers.watchFolder}`);
      }
      
      return;
    }

    // Validate folder exists
    if (!fs.existsSync(answers.watchFolder)) {
      console.error(`✗ Folder does not exist: ${answers.watchFolder}`);
      console.log('Please create the folder or specify a different path with --folder');
      process.exit(1);
    }

    return this.completeSetup(answers);
  }

  getArgValue(argName) {
    const args = process.argv;
    const index = args.indexOf(argName);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
  }

  getBooleanArg(argName, defaultValue) {
    const value = this.getArgValue(argName);
    if (value === null) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  async completeSetup(answers) {
    // Validate configuration before saving
    const validation = config.validateForSetup(answers);
    if (!validation.valid) {
      Welcome.showError('Configuration validation failed:', validation.errors);
      process.exit(1);
    }

    // Save configuration
    const success = config.save(answers);
    if (!success) {
      Welcome.showError('Failed to save configuration');
      process.exit(1);
    }

    console.log('\n✓ Configuration saved successfully!');

    // Test API key
    console.log('\nTesting Gemini API key...');
    geminiAnalyzer.updateAPIKey(answers.geminiApiKey);
    const apiTest = await geminiAnalyzer.testConnection();
    
    if (apiTest.success) {
      console.log('✓ API key is valid and working');
      
      // Show success message
      Welcome.showSuccess(`
Setup complete! Your screenshots will now be automatically renamed with AI.

🎯 Next steps:
1. npm run install-service  (for background operation)
2. Add images to: ${answers.watchFolder}
3. Watch them get perfect AI names! 🍳
      `);
    } else {
      Welcome.showError('API key test failed', [
        'Check your API key is correct',
        'Ensure you have internet connection', 
        'Visit https://makersuite.google.com/app/apikey to get a new key',
        'Run setup again: npm run setup'
      ]);
      console.log('\nYou can update the API key later by running setup again.');
    }
  }

  async showFolderSuggestions() {
    const suggestions = [
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads'),
      path.join(os.homedir(), 'Pictures'),
      '/Users/maxmilne/Library/CloudStorage/OneDrive-SwinburneUniversity/0. Inbox/Screenshots'
    ].filter(folder => fs.existsSync(folder));

    if (suggestions.length > 0) {
      console.log('\nCommon folder suggestions:');
      suggestions.forEach((folder, index) => {
        console.log(`  ${index + 1}. ${folder}`);
      });
      console.log();
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new Setup();
  setup.run().catch(console.error);
}

module.exports = Setup;