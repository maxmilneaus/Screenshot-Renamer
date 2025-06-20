#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const configPath = path.join(os.homedir(), '.screenshot-renamer-config.json');

if (process.argv.length < 3) {
  console.log('Usage: node configure.js <GEMINI_API_KEY>');
  console.log('Example: node configure.js AIzaSyB...');
  process.exit(1);
}

const apiKey = process.argv[2];

try {
  let config = {};
  
  // Load existing config if it exists
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  
  // Update API key
  config.geminiApiKey = apiKey;
  
  // Set defaults if not present
  config.watchFolder = config.watchFolder || '/Users/maxmilne/Library/CloudStorage/OneDrive-SwinburneUniversity/0. Inbox/Screenshots';
  config.copyToClipboard = config.copyToClipboard !== undefined ? config.copyToClipboard : true;
  config.showNotifications = config.showNotifications !== undefined ? config.showNotifications : true;
  config.logLevel = config.logLevel || 'info';
  
  // Save config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log('✓ Configuration updated successfully!');
  console.log('Current settings:');
  console.log(`  Watch Folder: ${config.watchFolder}`);
  console.log(`  API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`  Clipboard Copy: ${config.copyToClipboard}`);
  console.log(`  Notifications: ${config.showNotifications}`);
  
  console.log('\nService will automatically pick up the new configuration.');
  console.log('You can now add images to your Screenshots folder and they will be renamed!');
  
} catch (error) {
  console.error('Error updating configuration:', error.message);
  process.exit(1);
}