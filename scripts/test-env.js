#!/usr/bin/env node

const fetch = require('node-fetch');
const config = require('../src/config');
const AnalyzerFactory = require('../src/analyzers/analyzer-factory');
const logger = require('../src/logger');

async function testEnvironment() {
  logger.level = 'info';
  const currentConfig = config.load();
  const provider = currentConfig.aiProvider;

  if (!provider) {
    logger.error('No AI provider is configured. Please run `npm run setup` first.');
    process.exit(1);
  }

  logger.info(`🧪 Testing connection for configured provider: ${provider}`);

  try {
    const analyzer = AnalyzerFactory.createAnalyzer(currentConfig);
    const result = await analyzer.testConnection();

    if (result.success) {
      logger.info(`✅  ${provider} connection successful!`);
      logger.info(`   Response: ${result.response || 'OK'}`);
      process.exit(0);
    } else {
      logger.error(`❌  ${provider} connection failed.`);
      logger.error(`   Error: ${result.error}`);
      
      if (provider === 'gemini') {
        logger.info('\n💡 Suggestions:');
        logger.info('   - Check your API key is correct.');
        logger.info('   - Ensure you have internet connection.');
        logger.info('   - Visit https://aistudio.google.com/apikey to get a new key.');
      } else if (provider === 'lmstudio') {
        logger.info('\n💡 Suggestions:');
        logger.info('   - Make sure LM Studio is running.');
        logger.info('   - Verify the server address in your config is correct.');
        logger.info('   - Check that a vision model (like llava) is loaded in LM Studio.');
      } else if (provider === 'ollama') {
        logger.info('\n💡 Suggestions:');
        logger.info('   - Make sure Ollama is installed and running.');
        logger.info('   - Try: curl -fsSL https://ollama.com/install.sh | sh');
        logger.info('   - Then: ollama pull llava');
        logger.info('   - Verify the server address in your config is correct.');
      }
      
      process.exit(1);
    }
  } catch (error) {
    logger.error('An unexpected error occurred during the environment test:', error);
    process.exit(1);
  }
}

testEnvironment();