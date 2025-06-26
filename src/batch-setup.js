#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const BatchSettings = require('./batch-settings');

class BatchSetup {
  constructor() {
    this.batchSettings = new BatchSettings();
    this.isInteractive = this.checkInteractiveCapability();
  }

  checkInteractiveCapability() {
    return process.stdin.isTTY && process.stdout.isTTY && !process.env.CI;
  }

  async run() {
    console.log('🎯 Screenshot Renamer - Batch Setup\n');
    
    if (!this.isInteractive) {
      console.log('⚠️  Non-interactive environment detected.');
      console.log('Cannot run setup in non-interactive mode.\n');
      return false;
    }

    try {
      const currentSettings = this.batchSettings.load();
      
      console.log('📋 Current batch settings:');
      this.displayCurrentSettings(currentSettings);
      console.log('');

      const setupChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🔧 Configure batch settings', value: 'configure' },
            { name: '📋 Use template', value: 'template' },
            { name: '💾 Save current as template', value: 'save_template' },
            { name: '🔄 Reset to defaults', value: 'reset' },
            { name: '📤 Export settings', value: 'export' },
            { name: '📥 Import settings', value: 'import' },
            { name: '❌ Exit', value: 'exit' }
          ]
        }
      ]);

      switch (setupChoice.action) {
        case 'configure':
          return await this.configureSettings(currentSettings);
        case 'template':
          return await this.useTemplate();
        case 'save_template':
          return await this.saveTemplate(currentSettings);
        case 'reset':
          return await this.resetSettings();
        case 'export':
          return await this.exportSettings();
        case 'import':
          return await this.importSettings();
        case 'exit':
          console.log('👋 Goodbye!');
          return true;
      }
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      return false;
    }
  }

  displayCurrentSettings(settings) {
    console.log(`   📁 Folder: ${settings.lastUsedFolder}`);
    console.log(`   🏷️  Prefix: ${settings.defaultPrefix || '(none)'}`);
    console.log(`   📝 Format: ${settings.filenameFormat}`);
    console.log(`   🔄 Mode: ${settings.processMode}`);
    console.log(`   📋 Clipboard: ${settings.copyToClipboard ? 'Yes' : 'No'}`);
    console.log(`   🗂️  File types: ${settings.fileTypes.join(', ')}`);
  }

  async configureSettings(currentSettings) {
    console.log('\n🔧 Configuring batch settings...\n');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'lastUsedFolder',
        message: '📁 Which folder would you like to process?',
        default: currentSettings.lastUsedFolder,
        validate: (input) => {
          if (!fs.existsSync(input)) {
            return 'Folder does not exist. Please enter a valid path.';
          }
          if (!fs.statSync(input).isDirectory()) {
            return 'Path is not a directory. Please enter a folder path.';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'processMode',
        message: '🔄 How would you like to process files?',
        choices: [
          { name: 'Rename files in place (replaces originals)', value: 'rename' },
          { name: 'Copy renamed files to new location', value: 'copy' },
          { name: 'Preview only (no changes)', value: 'preview' }
        ],
        default: currentSettings.processMode
      },
      {
        type: 'input',
        name: 'copyDestination',
        message: '📂 Where should renamed copies be saved?',
        default: currentSettings.copyDestination || path.join(os.homedir(), 'Desktop', 'renamed_images'),
        when: (answers) => answers.processMode === 'copy',
        validate: (input) => {
          const dir = path.dirname(input);
          if (!fs.existsSync(dir)) {
            return 'Parent directory does not exist.';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'filenameFormat',
        message: '📝 Choose filename format:',
        choices: [
          { name: 'Description only (e.g., "user_login_screen")', value: '{description}' },
          { name: 'Prefix + Description (e.g., "myapp_user_login_screen")', value: '{prefix}_{description}' },
          { name: 'Prefix - Description (e.g., "myapp-user-login-screen")', value: '{prefix}-{description}' },
          { name: 'Date + Prefix + Description (e.g., "2024-01-15_myapp_user_login")', value: '{date}_{prefix}_{description}' }
        ],
        default: currentSettings.filenameFormat
      },
      {
        type: 'input',
        name: 'defaultPrefix',
        message: '🏷️  Enter project prefix (leave empty for none):',
        default: currentSettings.defaultPrefix,
        when: (answers) => answers.filenameFormat.includes('{prefix}')
      },
      {
        type: 'list',
        name: 'separator',
        message: '🔗 Choose separator character:',
        choices: [
          { name: 'Underscore (_)', value: '_' },
          { name: 'Dash (-)', value: '-' },
          { name: 'Dot (.)', value: '.' }
        ],
        default: currentSettings.separator,
        when: (answers) => answers.filenameFormat.includes('_') || answers.filenameFormat.includes('-')
      },
      {
        type: 'confirm',
        name: 'skipProcessed',
        message: '⏭️  Skip files that appear already processed?',
        default: currentSettings.skipProcessed
      },
      {
        type: 'confirm',
        name: 'copyToClipboard',
        message: '📋 Copy renamed files to clipboard?',
        default: currentSettings.copyToClipboard,
        when: (answers) => answers.processMode === 'rename'
      },
      {
        type: 'confirm',
        name: 'createBackup',
        message: '💾 Create backup of original filenames (for undo)?',
        default: currentSettings.createBackup
      },
      {
        type: 'checkbox',
        name: 'fileTypes',
        message: '🗂️  Which file types should be processed?',
        choices: [
          { name: 'PNG files', value: 'png', checked: true },
          { name: 'JPEG files', value: 'jpg', checked: true },
          { name: 'JPEG files (jpeg)', value: 'jpeg', checked: true },
          { name: 'GIF files', value: 'gif', checked: true },
          { name: 'WebP files', value: 'webp', checked: true }
        ],
        default: currentSettings.fileTypes,
        validate: (input) => {
          if (input.length === 0) {
            return 'Please select at least one file type.';
          }
          return true;
        }
      }
    ]);

    // Apply separator to filename format if needed
    if (answers.separator && answers.filenameFormat) {
      answers.filenameFormat = answers.filenameFormat.replace(/_/g, answers.separator);
    }

    // Save settings
    const success = this.batchSettings.save(answers);
    
    if (success) {
      console.log('\n✅ Batch settings saved successfully!');
      console.log('\nYou can now run:');
      console.log(`   npm run batch-rename "${answers.lastUsedFolder}"`);
      
      // Ask if user wants to run immediately
      const runNow = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'execute',
          message: '🚀 Would you like to run the batch processor now?',
          default: true
        }
      ]);
      
      if (runNow.execute) {
        return await this.runBatchProcessor(answers.lastUsedFolder, answers);
      }
      
      return true;
    } else {
      console.log('\n❌ Failed to save settings.');
      return false;
    }
  }

  async useTemplate() {
    const templates = this.batchSettings.getAvailableTemplates();
    
    if (templates.length === 0) {
      console.log('\n📋 No templates available. Create one first!');
      return false;
    }

    const templateChoice = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: '📋 Choose a template:',
        choices: templates.map(name => ({ name, value: name }))
      }
    ]);

    const template = this.batchSettings.getTemplate(templateChoice.template);
    const currentSettings = this.batchSettings.load();
    
    // Merge template with current settings
    const newSettings = {
      ...currentSettings,
      defaultPrefix: template.prefix,
      filenameFormat: template.format,
      separator: template.separator
    };

    const success = this.batchSettings.save(newSettings);
    
    if (success) {
      console.log(`\n✅ Applied template: ${templateChoice.template}`);
      this.displayCurrentSettings(newSettings);
      
      // Ask if user wants to run immediately
      const runNow = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'execute',
          message: '🚀 Would you like to run the batch processor now?',
          default: true
        }
      ]);
      
      if (runNow.execute) {
        return await this.runBatchProcessor(newSettings.lastUsedFolder, newSettings);
      }
      
      return true;
    } else {
      console.log('\n❌ Failed to apply template.');
      return false;
    }
  }

  async saveTemplate(currentSettings) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'templateName',
        message: '💾 Enter template name:',
        validate: (input) => {
          if (!input.trim()) {
            return 'Template name cannot be empty.';
          }
          return true;
        }
      }
    ]);

    const templateSettings = {
      prefix: currentSettings.defaultPrefix,
      format: currentSettings.filenameFormat,
      separator: currentSettings.separator
    };

    const success = this.batchSettings.saveTemplate(answers.templateName, templateSettings);
    
    if (success) {
      console.log(`\n✅ Template "${answers.templateName}" saved successfully!`);
      return true;
    } else {
      console.log('\n❌ Failed to save template.');
      return false;
    }
  }

  async resetSettings() {
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reset',
        message: '⚠️  Are you sure you want to reset all settings to defaults?',
        default: false
      }
    ]);

    if (confirm.reset) {
      const success = this.batchSettings.reset();
      if (success) {
        console.log('\n✅ Settings reset to defaults.');
        return true;
      } else {
        console.log('\n❌ Failed to reset settings.');
        return false;
      }
    }
    
    console.log('\n👍 Reset cancelled.');
    return true;
  }

  async exportSettings() {
    const settingsJson = this.batchSettings.exportSettings();
    const exportPath = path.join(os.homedir(), 'Desktop', 'batch-settings-export.json');
    
    try {
      fs.writeFileSync(exportPath, settingsJson);
      console.log(`\n✅ Settings exported to: ${exportPath}`);
      return true;
    } catch (error) {
      console.log(`\n❌ Failed to export settings: ${error.message}`);
      return false;
    }
  }

  async importSettings() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'importPath',
        message: '📥 Enter path to settings file:',
        validate: (input) => {
          if (!fs.existsSync(input)) {
            return 'File does not exist.';
          }
          return true;
        }
      }
    ]);

    try {
      const settingsJson = fs.readFileSync(answers.importPath, 'utf8');
      const success = this.batchSettings.importSettings(settingsJson);
      
      if (success) {
        console.log('\n✅ Settings imported successfully!');
        return true;
      } else {
        console.log('\n❌ Failed to import settings.');
        return false;
      }
    } catch (error) {
      console.log(`\n❌ Failed to read settings file: ${error.message}`);
      return false;
    }
  }

  async previewFiles(folderPath) {
    const settings = this.batchSettings.load();
    const files = await this.getImageFiles(folderPath, settings.fileTypes);
    
    console.log(`\n📸 Found ${files.length} image files in: ${folderPath}`);
    
    if (files.length > 0) {
      console.log('\nFiles to process:');
      files.slice(0, 10).forEach((file, index) => {
        console.log(`   ${index + 1}. ${path.basename(file)}`);
      });
      
      if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more files`);
      }
    }
    
    return files;
  }

  async runBatchProcessor(folderPath, settings) {
    try {
      console.log('\n🚀 Starting batch processor...\n');
      
      // Import BatchRenamer dynamically to avoid circular dependencies
      const BatchRenamer = require('./batch-renamer');
      const batchRenamer = new BatchRenamer();
      
      // Ask for processing mode confirmation
      const confirmMode = await inquirer.prompt([
        {
          type: 'list',
          name: 'mode',
          message: '🔄 How would you like to proceed?',
          choices: [
            { name: '🚀 Process files now', value: 'process' },
            { name: '🔍 Preview changes first', value: 'preview' },
            { name: '❌ Cancel', value: 'cancel' }
          ],
          default: settings.processMode === 'preview' ? 'preview' : 'process'
        }
      ]);
      
      if (confirmMode.mode === 'cancel') {
        console.log('\n👋 Operation cancelled.');
        return true;
      }
      
      const isPreview = confirmMode.mode === 'preview';
      const result = await batchRenamer.processFolder(folderPath, { preview: isPreview });
      
      // If preview mode and user wants to continue
      if (isPreview && result.preview) {
        const continueChoice = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: '\n🚀 Execute these changes?',
            default: false
          }
        ]);
        
        if (continueChoice.proceed) {
          console.log('\n🚀 Executing batch processor...\n');
          await batchRenamer.processFolder(folderPath, { preview: false });
        } else {
          console.log('\n👍 Changes not applied.');
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('\n💥 Batch processor failed:', error.message);
      return false;
    }
  }

  async getImageFiles(folderPath, fileTypes) {
    const files = await fs.promises.readdir(folderPath);
    const imageFiles = [];
    
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stat = await fs.promises.stat(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase().substring(1);
        if (fileTypes.includes(ext)) {
          imageFiles.push(fullPath);
        }
      }
    }
    
    return imageFiles.sort();
  }
}

// Handle command line usage
if (require.main === module) {
  const batchSetup = new BatchSetup();
  
  batchSetup.run()
    .then((success) => {
      if (success) {
        console.log('\n🎉 Setup completed successfully!');
        process.exit(0);
      } else {
        console.log('\n💥 Setup failed.');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Setup error:', error.message);
      process.exit(1);
    });
}

module.exports = BatchSetup;