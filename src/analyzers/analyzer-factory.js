const GeminiVisionAnalyzer = require('../gemini-vision');
const LMStudioVisionAnalyzer = require('../lmstudio-vision');
const OllamaAnalyzer = require('./ollama-analyzer');
const logger = require('../logger');

/**
 * Factory for creating and managing AI analyzer instances
 */
class AnalyzerFactory {
  /**
   * Create an analyzer instance based on configuration
   * @param {Object} config - Configuration object
   * @returns {Object} Configured analyzer instance
   */
  static createAnalyzer(config) {
    if (!config) {
      throw new Error('Configuration is required to create analyzer');
    }

    const provider = config.aiProvider || 'gemini';

    switch (provider) {
      case 'gemini':
        return new GeminiVisionAnalyzer(config);
        
      case 'lmstudio':
        return new LMStudioVisionAnalyzer(config);
        
      case 'ollama':
        return new OllamaAnalyzer(config);
        
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }

  /**
   * Get available analyzer types
   * @returns {Array} Array of available provider names
   */
  static getAvailableProviders() {
    return ['gemini', 'lmstudio', 'ollama'];
  }

  /**
   * Validate that a provider is supported
   * @param {string} provider - Provider name to validate
   * @returns {boolean} True if provider is supported
   */
  static isValidProvider(provider) {
    return this.getAvailableProviders().includes(provider);
  }
}

module.exports = AnalyzerFactory;