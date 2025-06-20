#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class ServiceInstaller {
  constructor() {
    this.projectPath = path.resolve(__dirname, '..');
    this.homePath = os.homedir();
    this.launchAgentPath = path.join(this.homePath, 'Library', 'LaunchAgents');
    this.plistName = 'com.user.screenshot-renamer.plist';
    this.plistPath = path.join(this.launchAgentPath, this.plistName);
    this.templatePath = path.join(__dirname, this.plistName);
  }

  async install() {
    try {
      console.log('Installing Screenshot Renamer as macOS service...');
      
      // Ensure LaunchAgents directory exists
      if (!fs.existsSync(this.launchAgentPath)) {
        fs.mkdirSync(this.launchAgentPath, { recursive: true });
        console.log('✓ Created LaunchAgents directory');
      }

      // Read and customize the plist template
      let plistContent = fs.readFileSync(this.templatePath, 'utf8');
      plistContent = plistContent
        .replace(/__PROJECT_PATH__/g, this.projectPath)
        .replace(/__HOME__/g, this.homePath);

      // Write the customized plist
      fs.writeFileSync(this.plistPath, plistContent);
      console.log('✓ Created Launch Agent plist');

      // Load the service
      try {
        execSync(`launchctl load ${this.plistPath}`, { stdio: 'pipe' });
        console.log('✓ Service loaded successfully');
      } catch (error) {
        // If already loaded, unload and reload
        try {
          execSync(`launchctl unload ${this.plistPath}`, { stdio: 'pipe' });
          execSync(`launchctl load ${this.plistPath}`, { stdio: 'pipe' });
          console.log('✓ Service reloaded successfully');
        } catch (reloadError) {
          console.error('Failed to load service:', reloadError.message);
          throw reloadError;
        }
      }

      // Create log directory
      const logDir = path.join(this.homePath, 'Library', 'Logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      console.log('\n✓ Screenshot Renamer installed as background service!');
      console.log('\nService Details:');
      console.log(`  Name: ${this.plistName}`);
      console.log(`  Logs: ${path.join(logDir, 'screenshot-renamer.log')}`);
      console.log(`  Error Logs: ${path.join(logDir, 'screenshot-renamer-error.log')}`);
      console.log('\nService Commands:');
      console.log(`  Check status: launchctl list | grep screenshot-renamer`);
      console.log(`  Stop service: launchctl unload ${this.plistPath}`);
      console.log(`  Start service: launchctl load ${this.plistPath}`);
      console.log(`  Uninstall: npm run uninstall-service`);
      console.log('\nThe service will automatically start on login and run in the background.');

    } catch (error) {
      console.error('Installation failed:', error.message);
      
      // Cleanup on failure
      if (fs.existsSync(this.plistPath)) {
        try {
          fs.unlinkSync(this.plistPath);
          console.log('Cleaned up plist file');
        } catch (cleanupError) {
          console.error('Failed to cleanup plist file:', cleanupError.message);
        }
      }
      
      process.exit(1);
    }
  }

  getStatus() {
    try {
      const result = execSync('launchctl list | grep screenshot-renamer', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.trim()) {
        console.log('✓ Service is running');
        console.log('Details:', result.trim());
        return true;
      }
    } catch (error) {
      console.log('✗ Service is not running');
      return false;
    }
  }

  showLogs() {
    const logFile = path.join(this.homePath, 'Library', 'Logs', 'screenshot-renamer.log');
    const errorLogFile = path.join(this.homePath, 'Library', 'Logs', 'screenshot-renamer-error.log');
    
    console.log('Recent logs:');
    console.log('============');
    
    if (fs.existsSync(logFile)) {
      try {
        const logs = execSync(`tail -20 "${logFile}"`, { encoding: 'utf8' });
        console.log(logs);
      } catch (error) {
        console.log('No recent logs available');
      }
    } else {
      console.log('Log file not found');
    }

    if (fs.existsSync(errorLogFile)) {
      console.log('\nRecent errors:');
      console.log('==============');
      try {
        const errorLogs = execSync(`tail -10 "${errorLogFile}"`, { encoding: 'utf8' });
        if (errorLogs.trim()) {
          console.log(errorLogs);
        } else {
          console.log('No recent errors');
        }
      } catch (error) {
        console.log('No error logs available');
      }
    }
  }
}

// Handle command line usage
if (require.main === module) {
  const installer = new ServiceInstaller();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      installer.getStatus();
      break;
    case 'logs':
      installer.showLogs();
      break;
    default:
      installer.install();
      break;
  }
}

module.exports = ServiceInstaller;