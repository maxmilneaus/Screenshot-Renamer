#!/usr/bin/env node

const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./config');
const AnalyzerFactory = require('./analyzers/analyzer-factory');
const geminiModels = require('./gemini-models');
const Welcome = require('./welcome');

// Suppress verbose logging during setup to keep interface clean
const logger = require('./logger');
logger.level = 'warn';

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

    console.log('\nInitiating the configuration process...\n');

    try {
      const currentConfig = config.load();
      
      // Present current arrangements
      Welcome.showCurrentSettings(currentConfig);

      const answers = await this.promptWithFallback([
        {
          type: 'input',
          name: 'watchFolder',
          message: '📁 Which folder shall we observe for new images?',
          default: currentConfig.watchFolder,
          validate: (input) => {
            if (!input.trim()) return 'A folder path is required.';
            if (!fs.existsSync(input.trim())) {
              return 'The specified folder does not exist. Please provide a valid path.';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'aiProvider',
          message: '🤖 Select your preferred AI companion:',
          choices: [
            {
              name: 'Gemini (Cloud-based)',
              value: 'gemini'
            },
            {
              name: 'LM Studio (Local)',
              value: 'lmstudio'
            },
            {
              name: 'Ollama (Local)',
              value: 'ollama'
            }
          ],
          default: currentConfig.aiProvider || 'gemini'
        }
      ]);

      // Add provider-specific configuration
      if (answers.aiProvider === 'gemini') {
        console.log('\n💡 A note on API keys: Acquire yours at: https://aistudio.google.com/apikey\n');
        
        const geminiConfig = await this.promptWithFallback([
          {
            type: 'password',
            name: 'geminiApiKey',
            message: '🔑 Your Gemini API key:\n  (The necessary credential for Google\'s AI)',
            default: currentConfig.geminiApiKey,
            validate: (input) => {
              if (!input.trim()) return 'An API key is essential for Gemini.';
              return true;
            }
          }
        ]);
        Object.assign(answers, geminiConfig);
        
        // Add model selection for Gemini
        console.log('\n🤖 Retrieving available Gemini models...');
        try {
          const models = await geminiModels.getAvailableModels(answers.geminiApiKey);
          
          console.log('\n📋 Available Models:');
          const categorized = geminiModels.categorizeModels(models);
          
          if (categorized.recommended.length > 0) {
            console.log('  ⭐ Recommended:');
            categorized.recommended.forEach(model => {
              console.log(`     ${model.displayName}: ${model.description}`);
              console.log(`     💰 ${model.pricing.note}`);
            });
          }
          
          // Use progressive disclosure for model selection
          let selectedModel = null;
          let currentChoices = geminiModels.getProgressiveChoices();
          
          while (!selectedModel) {
            const modelConfig = await this.promptWithFallback([
              {
                type: 'list',
                name: 'geminiModel',
                message: '🎯 Select your Gemini model:',
                choices: currentChoices,
                default: currentConfig.geminiModel || 'gemini-2.0-flash-exp'
              }
            ]);
            
            const choice = modelConfig.geminiModel;
            
            switch (choice) {
              case 'show_experimental':
                console.log('\n🧪 Experimental Models:');
                categorized.experimental.forEach(model => {
                  console.log(`   ${model.displayName}: ${model.description}`);
                  console.log(`   💰 ${model.pricing.note}`);
                });
                currentChoices = geminiModels.formatModelChoices('experimental');
                currentChoices.push({ name: '⬅️ Return to main options', value: 'back', short: 'Back' });
                break;
                
              case 'show_legacy':
                console.log('\n📜 Legacy Models:');
                categorized.legacy.forEach(model => {
                  console.log(`   ${model.displayName}: ${model.description}`);
                  console.log(`   💰 ${model.pricing.note}`);
                });
                currentChoices = geminiModels.formatModelChoices('legacy');
                currentChoices.push({ name: '⬅️ Return to main options', value: 'back', short: 'Back' });
                break;
                
              case 'show_all':
                console.log('\n📋 All Available Models:');
                models.forEach(model => {
                  const icon = model.recommended ? '⭐' : (model.legacy ? '📜' : (model.experimental ? '🧪' : '🔧'));
                  console.log(`   ${icon} ${model.displayName}: ${model.description}`);
                  console.log(`      💰 ${model.pricing.note}`);
                });
                currentChoices = geminiModels.formatModelChoices('all');
                currentChoices.push({ name: '⬅️ Return to main options', value: 'back', short: 'Back' });
                break;
                
              case 'back':
                currentChoices = geminiModels.getProgressiveChoices();
                break;
                
              default:
                selectedModel = choice;
                answers.geminiModel = selectedModel;
                break;
            }
          }
          
        } catch (error) {
          console.log('⚠️  Could not retrieve models. Proceeding with default: gemini-2.0-flash-exp');
          answers.geminiModel = 'gemini-2.0-flash-exp';
        }
      } else if (answers.aiProvider === 'lmstudio') {
        const lmstudioConfig = await this.promptWithFallback([
          {
            type: 'input',
            name: 'lmstudioBaseUrl',
            message: '🏠 LM Studio server address:',
            default: currentConfig.lmstudioBaseUrl || 'http://localhost:1234',
            validate: (input) => {
              try {
                new URL(input.trim());
                return true;
              } catch {
                return 'Please provide a valid URL (e.g., http://localhost:1234)';
              }
            }
          },
          {
            type: 'input',
            name: 'lmstudioModel',
            message: '🧠 Model name within LM Studio:',
            default: currentConfig.lmstudioModel || 'google/gemma-3-4b'
          }
        ]);
        Object.assign(answers, lmstudioConfig);
      } else if (answers.aiProvider === 'ollama') {
        console.log('\n🦙 Configuring Ollama (ensure Ollama is installed and active)\n');
        
        const ollamaConfig = await this.promptWithFallback([
          {
            type: 'input',
            name: 'ollamaBaseUrl',
            message: '🏠 Ollama server address:',
            default: currentConfig.ollamaBaseUrl || 'http://localhost:11434',
            validate: (input) => {
              try {
                new URL(input.trim());
                return true;
              } catch {
                return 'Please provide a valid URL (e.g., http://localhost:11434)';
              }
            }
          },
          {
            type: 'input',
            name: 'ollamaModel',
            message: '🧠 Vision model name (llava is often suitable):',
            default: currentConfig.ollamaModel || 'gemma3:4b'
          }
        ]);
        Object.assign(answers, ollamaConfig);
      }

      // Add general preferences
      const preferences = await this.promptWithFallback([
        {
          type: 'confirm',
          name: 'copyToClipboard',
          message: '📋 Should renamed images be placed on the clipboard automatically?',
          default: currentConfig.copyToClipboard
        },
      ]);
      Object.assign(answers, preferences);

      return this.completeSetup(answers);

    } catch (error) {
      if (error.isTtyError || error.code === 'ERR_USE_AFTER_CLOSE') {
        console.log('⚠️  Interactive prompts are not available. Falling back to non-interactive mode.');
        return this.runNonInteractive();
      } else {
        logger.error('Setup encountered an issue:', error);
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
    const provider = this.getArgValue('--ai-provider') || currentConfig.aiProvider;
    const answers = {
      watchFolder: this.getArgValue('--folder') || currentConfig.watchFolder,
      aiProvider: provider,
      geminiApiKey: this.getArgValue('--api-key') || currentConfig.geminiApiKey,
      copyToClipboard: this.getBooleanArg('--clipboard', currentConfig.copyToClipboard),
      ollamaModel: this.getArgValue('--ollama-model') || currentConfig.ollamaModel,
      ollamaBaseUrl: this.getArgValue('--ollama-base-url') || currentConfig.ollamaBaseUrl,
      lmstudioModel: this.getArgValue('--lmstudio-model') || currentConfig.lmstudioModel,
      lmstudioBaseUrl: this.getArgValue('--lmstudio-base-url') || currentConfig.lmstudioBaseUrl,
    };

    // If no API key provided for Gemini, show instructions
    if (answers.aiProvider === 'gemini' && !answers.geminiApiKey) {
      console.log('🔑 Google Gemini API Key Required');
      console.log('================================');
      console.log('1. Visit: https://aistudio.google.com/apikey');
      console.log('2. Create an API key');
      console.log('3. Run setup again with: npm run setup -- --api-key YOUR_KEY');
      console.log('\nOr use the configure script:');
      console.log('node configure.js YOUR_API_KEY');
      console.log('\nExample:');
      console.log('npm run setup -- --api-key YOUR_API_KEY_HERE --folder "/path/to/folder"');
      
      // Save partial config
      if (answers.watchFolder !== currentConfig.watchFolder) {
        config.update({ watchFolder: answers.watchFolder });
        console.log(`\n✓ Watch folder updated: ${answers.watchFolder}`);
      }
      
      return;
    }

    // Validate folder exists
    if (!fs.existsSync(answers.watchFolder)) {
      logger.error(`✗ Folder does not exist: ${answers.watchFolder}`);
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

    // In non-interactive mode, we'll skip the connection test,
    // as services like LM Studio might not be running in a CI/test environment.
    if (!this.isInteractive) {
      console.log('\nSkipping connection test in non-interactive mode.');
      Welcome.showSuccess(`
Configuration is saved. You can test the connection by running setup again
in an interactive terminal or by starting the service.
      `);
      return;
    }

    // Test the configured provider
    const provider = answers.aiProvider;
    console.log(`\n🧪 Testing ${provider} connection...`);
    
    let analyzer, apiTest;
    try {
      analyzer = AnalyzerFactory.createAnalyzer(answers);
    } catch (error) {
      logger.error('Failed to create analyzer:', error);
      Welcome.showError('Failed to create analyzer', [error.message]);
      return;
    }
    
    apiTest = await analyzer.testConnection();
    
    if (apiTest.success) {
      console.log(`✓ ${provider} is working perfectly`);
      
      // Show success message
      Welcome.showSuccess(`
Setup complete! Your screenshots will now be automatically renamed with AI.

🎯 Next steps:
1. npm run install-service  (for background operation)
2. Add images to: ${answers.watchFolder}
3. Watch them get perfect AI names!
      `);
    } else {
      let errorMessages;
      if (provider === 'gemini') {
        errorMessages = [
          'Check your API key is correct',
          'Ensure you have internet connection',
          'Visit https://aistudio.google.com/apikey to get a new key'
        ];
      } else if (provider === 'lmstudio') {
        errorMessages = [
          'Make sure LM Studio is running',
          'Verify the server address is correct',
          'Check that a vision model (like llava) is loaded'
        ];
      } else if (provider === 'ollama') {
        errorMessages = [
          'Make sure Ollama is installed and running',
          'Try: curl -fsSL https://ollama.com/install.sh | sh',
          'Then: ollama pull llava',
          'Verify the server address is correct'
        ];
      }
      
      Welcome.showError(`${provider} connection failed`, [
        ...errorMessages,
        'Run setup again: npm run setup'
      ]);
      console.log('\nYou can update the configuration later by running setup again.');
    }
  }

  async showFolderSuggestions() {
    const suggestions = [
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Downloads'),
      path.join(os.homedir(), 'Pictures'),
      path.join(os.homedir(), 'Documents', 'Screenshots')
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