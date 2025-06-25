const chalk = require('chalk');

class Welcome {
  static show() {
    // Clear any previous output to maintain a clean workspace
    console.clear();
    
    console.log(chalk.green(`
A quiet utility for thoughtful naming.
    `));
  }

  static showQuickStart() {
    console.log(chalk.blue(`
${chalk.bold('Quick Start')}
──────────────────
${chalk.yellow('1.')} npm install        ${chalk.gray('# Prepare the tools')}
${chalk.yellow('2.')} npm run setup      ${chalk.gray('# Configure the instrument')}
${chalk.yellow('3.')} npm run install-service ${chalk.gray('# Establish background operation')}

Then, simply introduce images to your designated folder and observe the transformation.
    `));
  }

  static showCurrentSettings(config) {
    console.log('Current arrangements:');
    console.log(`  📁 Observed Folder: ${config.watchFolder}`);
    console.log(`  🤖 AI Companion: ${config.aiProvider || 'gemini'}`);
    console.log(`  🔑 API Key: ${config.geminiApiKey ? '✓ Configured' : '✗ Not set'}`);
    console.log(`  📋 Clipboard Integration: ${config.copyToClipboard ? 'Enabled' : 'Disabled'}`);
  }

  static showStatus(config, isServiceRunning = false) {
    console.log(chalk.blue(`
    ${chalk.bold('Current State')}
    ──────────────────
    ${chalk.yellow('Observed Folder:')} ${config.watchFolder || chalk.red('Not set')}
    ${chalk.yellow('API Key:')} ${config.geminiApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Missing')}
    ${chalk.yellow('Clipboard:')} ${config.copyToClipboard ? chalk.green('Enabled') : chalk.gray('Disabled')}
    ${chalk.yellow('Service:')} ${isServiceRunning ? chalk.green('🟢 Active') : chalk.red('🔴 Dormant')}
    `));
  }

  static showSuccess(message) {
    console.log(chalk.green(`
    ${chalk.bold('Task Completed')}
    ${message}
    
    Your images will now receive their thoughtful names.
    `));
  }

  static showError(message, suggestions = []) {
    console.log(chalk.red(`
    ${chalk.bold('An Observation:')}
    ${message}
    `));

    if (suggestions.length > 0) {
      console.log(chalk.yellow(`
    ${chalk.bold('Consider these adjustments:')}
    ${suggestions.map(s => `    ${chalk.cyan('▶')} ${s}`).join('\\n')}
      `));
    }
  }

  static showConfigHelp() {
    console.log(chalk.blue(`
    ${chalk.bold('Configuration Guidance')}
    ────────────────────────
    
    ${chalk.yellow('API Key:')} Obtain yours from ${chalk.cyan('https://aistudio.google.com/apikey')}
    ${chalk.yellow('Folder:')} Common locations include:
    ${chalk.gray('  • ~/Desktop')}
    ${chalk.gray('  • ~/Downloads')}
    ${chalk.gray('  • ~/Pictures')}
    ${chalk.gray('  • Custom cloud storage paths')}
    
    ${chalk.yellow('Commands:')}
    ${chalk.cyan('npm run setup')}                 ${chalk.gray('# Interactive configuration')}
    ${chalk.cyan('npm run setup -- --api-key KEY')} ${chalk.gray('# Expedited configuration')}
    ${chalk.cyan('npm start -- --status')}         ${chalk.gray('# Inquire about current state')}
    `));
  }
}

module.exports = Welcome;