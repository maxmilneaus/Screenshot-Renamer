#!/usr/bin/env node

const { program } = require('commander');
const config = require('./config');
const ScreenshotRenamer = require('./index');
const Setup = require('./setup');

program
  .name('screenshot-renamer')
  .description('A utility for thoughtful image renaming with clipboard integration.')
  .version('1.0.0');

program
  .command('start')
  .description('Initiate the image renaming service.')
  .option('-d, --dev', 'Operate in development mode, providing detailed observations.')
  .action(async (options) => {
    const renamer = new ScreenshotRenamer();
    if (options.dev) {
      console.log('Operating in development mode...');
    }
    await renamer.start();
  });

program
  .command('status')
  .description('Inquire about the current configuration and service state.')
  .action(async () => {
    const renamer = new ScreenshotRenamer();
    await renamer.status();
  });

program
  .command('setup')
  .description('Engage the interactive process to configure the utility.')
  .action(async () => {
    const setup = new Setup();
    await setup.run();
  });

program
  .command('config')
  .description('Manage the utility\'s operational settings.')
  .option('--folder <path>', 'Designate the folder to observe.')
  .option('--api-key <key>', 'Set the Gemini API key.')
  .option('--clipboard <true|false>', 'Enable or disable clipboard integration.')
  .option('--notifications <true|false>', 'Enable or disable notifications.')
  .option('--show', 'Display the current configuration.')
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
      console.log('No configuration adjustments specified. Consult --help for available options.');
      return;
    }

    const success = config.update(updates);
    if (success) {
      console.log('✓ Configuration updated successfully.');
    } else {
      logger.error('✗ Failed to update configuration.');
    }
  });

program
  .command('test')
  .description('Verify AI companion connection and clipboard functionality.')
  .action(async () => {
    const config = require('./config');
    const AnalyzerFactory = require('./analyzers/analyzer-factory');
    const clipboardManager = require('./clipboard-manager');

    try {
      const currentConfig = config.load();
      const analyzer = AnalyzerFactory.createAnalyzer(currentConfig);
      
      console.log(`Testing ${currentConfig.aiProvider || 'gemini'} connection...`);
      const apiTest = await analyzer.testConnection();
      console.log(`AI Companion: ${apiTest.success ? '✓ Operating' : '✗ ' + apiTest.error}`);

      console.log('Testing clipboard integration...');
      const clipboardTest = await clipboardManager.testClipboard();
      console.log(`Clipboard: ${clipboardTest.success ? '✓ Operating' : '✗ ' + clipboardTest.error}`);
    } catch (error) {
      console.log(`✗ Configuration issue: ${error.message}`);
    }
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