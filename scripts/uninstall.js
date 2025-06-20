#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class ServiceUninstaller {
  constructor() {
    this.homePath = os.homedir();
    this.plistName = 'com.user.screenshot-renamer.plist';
    this.plistPath = path.join(this.homePath, 'Library', 'LaunchAgents', this.plistName);
  }

  async uninstall() {
    try {
      console.log('Uninstalling Screenshot Renamer service...');

      // Check if service is running and unload it
      try {
        execSync(`launchctl unload ${this.plistPath}`, { stdio: 'pipe' });
        console.log('✓ Service stopped and unloaded');
      } catch (error) {
        console.log('Service was not running');
      }

      // Remove the plist file
      if (fs.existsSync(this.plistPath)) {
        fs.unlinkSync(this.plistPath);
        console.log('✓ Launch Agent plist removed');
      } else {
        console.log('Launch Agent plist not found');
      }

      // Optionally remove log files
      const logFile = path.join(this.homePath, 'Library', 'Logs', 'screenshot-renamer.log');
      const errorLogFile = path.join(this.homePath, 'Library', 'Logs', 'screenshot-renamer-error.log');

      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
        console.log('✓ Log file removed');
      }

      if (fs.existsSync(errorLogFile)) {
        fs.unlinkSync(errorLogFile);
        console.log('✓ Error log file removed');
      }

      console.log('\n✓ Screenshot Renamer service uninstalled successfully!');
      console.log('\nThe background service has been removed from your system.');
      console.log('You can still run the app manually with: npm start');

    } catch (error) {
      console.error('Uninstallation failed:', error.message);
      process.exit(1);
    }
  }

  checkStatus() {
    try {
      const result = execSync('launchctl list | grep screenshot-renamer', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.trim()) {
        console.log('⚠ Service is still running');
        console.log('Details:', result.trim());
        return true;
      }
    } catch (error) {
      console.log('✓ Service is not running');
    }

    if (fs.existsSync(this.plistPath)) {
      console.log('⚠ Launch Agent plist still exists');
      return true;
    } else {
      console.log('✓ Launch Agent plist removed');
    }

    return false;
  }
}

// Handle command line usage
if (require.main === module) {
  const uninstaller = new ServiceUninstaller();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'check':
    case 'status':
      uninstaller.checkStatus();
      break;
    default:
      uninstaller.uninstall();
      break;
  }
}

module.exports = ServiceUninstaller;