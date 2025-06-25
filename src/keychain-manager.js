const keytar = require('keytar');
const logger = require('./logger');

class KeychainManager {
  constructor() {
    this.serviceName = 'Screenshot Renamer';
    this.geminiAccountName = 'gemini-api-key';
  }

  async saveApiKey(apiKey) {
    try {
      if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('Invalid API key provided');
      }
      
      await keytar.setPassword(this.serviceName, this.geminiAccountName, apiKey);
      return { success: true };
    } catch (error) {
      logger.error('Failed to save API key to keychain:', error);
      return { success: false, error: error.message };
    }
  }

  async getApiKey() {
    try {
      const apiKey = await keytar.getPassword(this.serviceName, this.geminiAccountName);
      return { success: true, apiKey: apiKey || null };
    } catch (error) {
      logger.error('Failed to retrieve API key from keychain:', error);
      return { success: false, error: error.message, apiKey: null };
    }
  }

  async deleteApiKey() {
    try {
      const deleted = await keytar.deletePassword(this.serviceName, this.geminiAccountName);
      return { success: deleted };
    } catch (error) {
      logger.error('Failed to delete API key from keychain:', error);
      return { success: false, error: error.message };
    }
  }

  async hasApiKey() {
    const result = await this.getApiKey();
    return result.success && result.apiKey !== null;
  }
}

module.exports = new KeychainManager();