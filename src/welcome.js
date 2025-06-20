const chalk = require('chalk');

class Welcome {
  static show() {
    console.log(chalk.cyan(`
     ╔══════════════════════════════════════════════════════════════╗
     ║                                                              ║
     ║         ${chalk.yellow('🍳')} ${chalk.bold.magenta('lilsizzle')} ${chalk.yellow('🍳')} - Screenshot Renamer                    ║
     ║                                                              ║
     ╚══════════════════════════════════════════════════════════════╝
    `));

    console.log(chalk.yellow(`
           ${chalk.bold('🔥 SIZZLE SIZZLE! 🔥')}
                \\  |  /
                 \\ | /
        ═══════════${chalk.red('🍳')}═══════════
       ${chalk.yellow('◦ ◦')}     ${chalk.gray('~~~~~')}     ${chalk.yellow('◦ ◦')}
      ${chalk.yellow('◦')}    ${chalk.white('~')}   ${chalk.gray('~~~~~')}   ${chalk.white('~')}    ${chalk.yellow('◦')}
        ${chalk.yellow('◦')}     ${chalk.gray('~~~~~')}     ${chalk.yellow('◦')}
                ${chalk.gray('~~~~~')}
               ${chalk.gray('~~~~~~~')}
    `));

    console.log(chalk.green(`
    ${chalk.bold('🎯 AI-Powered Screenshot Renaming')}
    ────────────────────────────────────────────
    
    ${chalk.cyan('✨')} Transform: ${chalk.gray('Screenshot 2025-06-20 at 17.07.48@2x.png')}
    ${chalk.cyan('✨')} Into:      ${chalk.green('ai_powered_naming_tool.png')}
    
    ${chalk.bold('Features:')}
    ${chalk.green('▶')} Auto-rename with Google Gemini AI
    ${chalk.green('▶')} Perfect Obsidian integration  
    ${chalk.green('▶')} Background service operation
    ${chalk.green('▶')} Clipboard copy with filename preservation
    
    ${chalk.yellow('Ready to cook up some perfectly named screenshots! 🍳')}
    `));
  }

  static showQuickStart() {
    console.log(chalk.blue(`
    ${chalk.bold('🚀 Quick Start')}
    ──────────────────
    ${chalk.yellow('1.')} ${chalk.cyan('npm install')}        ${chalk.gray('# Install dependencies')}
    ${chalk.yellow('2.')} ${chalk.cyan('npm run setup')}      ${chalk.gray('# Configure API key & folder')}
    ${chalk.yellow('3.')} ${chalk.cyan('npm run install-service')} ${chalk.gray('# Install background service')}
    
    ${chalk.gray('Then just add images to your folder and watch the magic! ✨')}
    `));
  }

  static showStatus(config, isServiceRunning = false) {
    console.log(chalk.blue(`
    ${chalk.bold('📊 Current Status')}
    ──────────────────
    ${chalk.yellow('Watch Folder:')} ${config.watchFolder || chalk.red('Not set')}
    ${chalk.yellow('API Key:')} ${config.geminiApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Missing')}
    ${chalk.yellow('Clipboard:')} ${config.copyToClipboard ? chalk.green('Enabled') : chalk.gray('Disabled')}
    ${chalk.yellow('Service:')} ${isServiceRunning ? chalk.green('🟢 Running') : chalk.red('🔴 Stopped')}
    `));
  }

  static showSuccess(message) {
    console.log(chalk.green(`
    ${chalk.bold('🎉 SUCCESS! 🎉')}
    ${message}
    
    ${chalk.yellow('Time to sizzle! 🍳')} Your screenshots will now get perfect AI names!
    `));
  }

  static showError(message, suggestions = []) {
    console.log(chalk.red(`
    ${chalk.bold('🚨 Oops! Something went wrong 🚨')}
    ${message}
    `));

    if (suggestions.length > 0) {
      console.log(chalk.yellow(`
    ${chalk.bold('💡 Try these fixes:')}
    ${suggestions.map(s => `    ${chalk.cyan('▶')} ${s}`).join('\\n')}
      `));
    }
  }

  static showConfigHelp() {
    console.log(chalk.blue(`
    ${chalk.bold('🔧 Configuration Help')}
    ────────────────────────
    
    ${chalk.yellow('API Key:')} Get yours from ${chalk.cyan('https://makersuite.google.com/app/apikey')}
    ${chalk.yellow('Folder:')} Common locations:
    ${chalk.gray('  • ~/Desktop')}
    ${chalk.gray('  • ~/Downloads')} 
    ${chalk.gray('  • ~/Pictures')}
    ${chalk.gray('  • Custom OneDrive/Dropbox paths')}
    
    ${chalk.yellow('Commands:')}
    ${chalk.cyan('npm run setup')}                 ${chalk.gray('# Interactive setup')}
    ${chalk.cyan('npm run setup -- --api-key KEY')} ${chalk.gray('# Quick setup')}
    ${chalk.cyan('npm start -- --status')}         ${chalk.gray('# Check configuration')}
    `));
  }
}

module.exports = Welcome;