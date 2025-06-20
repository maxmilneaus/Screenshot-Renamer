#!/usr/bin/env node

const { program } = require('commander');
const config = require('./config');
const ScreenshotRenamer = require('./index');
const Setup = require('./setup');

program
  .name('screenshot-renamer')
  .description('AI-powered automatic image renaming with clipboard integration')
  .version('1.0.0');

program
  .command('start')
  .description('Start the image renaming service')
  .option('-d, --dev', 'Run in development mode with verbose logging')
  .action(async (options) => {
    const renamer = new ScreenshotRenamer();
    if (options.dev) {
      console.log('Running in development mode...');
    }
    await renamer.start();
  });

program
  .command('status')
  .description('Show current configuration and service status')
  .action(async () => {
    const renamer = new ScreenshotRenamer();
    await renamer.status();
  });

program
  .command('setup')
  .description('Run interactive setup to configure the service')
  .action(async () => {
    const setup = new Setup();
    await setup.run();
  });

program
  .command('config')
  .description('Manage configuration settings')
  .option('--folder <path>', 'Set the folder to watch')
  .option('--api-key <key>', 'Set the Gemini API key')
  .option('--clipboard <true|false>', 'Enable/disable clipboard copying')
  .option('--notifications <true|false>', 'Enable/disable notifications')
  .option('--show', 'Show current configuration')
  .action((options) => {
    if (options.show) {
      const currentConfig = config.load();
      console.log('Current Configuration:');
      console.log(JSON.stringify(currentConfig, null, 2));
      return;
    }

    const updates = {};
    if (options.folder) updates.watchFolder = options.folder;
    if (options.apiKey) updates.geminiApiKey = options.apiKey;
    if (options.clipboard) updates.copyToClipboard = options.clipboard === 'true';
    if (options.notifications) updates.showNotifications = options.notifications === 'true';

    if (Object.keys(updates).length === 0) {
      console.log('No configuration changes specified. Use --help for options.');
      return;
    }

    const success = config.update(updates);
    if (success) {
      console.log('✓ Configuration updated successfully');
    } else {
      console.error('✗ Failed to update configuration');
    }
  });

program
  .command('test')
  .description('Test API connection and clipboard functionality')
  .action(async () => {
    const geminiAnalyzer = require('./gemini-vision');
    const clipboardManager = require('./clipboard-manager');

    console.log('Testing Gemini API connection...');
    const apiTest = await geminiAnalyzer.testConnection();
    console.log(`API: ${apiTest.success ? '✓ Working' : '✗ ' + apiTest.error}`);

    console.log('Testing clipboard functionality...');
    const clipboardTest = await clipboardManager.testClipboard();
    console.log(`Clipboard: ${clipboardTest.success ? '✓ Working' : '✗ ' + clipboardTest.error}`);
  });

// Default action - run start command
program.action(async () => {
  const renamer = new ScreenshotRenamer();
  await renamer.start();
});

program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}