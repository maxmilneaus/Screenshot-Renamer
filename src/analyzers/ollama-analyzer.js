const fs = require('fs');
const { Ollama } = require('ollama');
const logger = require('../logger');
const { getMimeType, cleanFilename, getFallbackName } = require('../ai-utils');

class OllamaAnalyzer {
  constructor(config = null) {
    this.client = null;
    this.modelName = null;
    this.config = config;
    
    if (config) {
      this.initializeAPI();
    }
  }

  initializeAPI() {
    if (!this.config) {
      logger.error('No configuration provided to OllamaAnalyzer');
      return;
    }

    const baseUrl = this.config.ollamaBaseUrl || 'http://localhost:11434';
    this.modelName = this.config.ollamaModel || 'gemma3:4b';
    
    this.client = new Ollama({
      host: baseUrl
    });
    
    logger.info(`Ollama configured: ${baseUrl} with model ${this.modelName}`);
  }

  async analyzeImage(imagePath) {
    try {
      // Read the image file
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Prepare the prompt for naming
      const prompt = `Analyze this image and provide a short, descriptive filename (without extension) that would be suitable for organizing this image. 
      Focus on the main subject, action, or content of the image. 
      Use clear, simple words separated by underscores.
      Examples: "login_screen", "dashboard_overview", "error_message", "user_profile", "mobile_menu"
      Keep it under 50 characters and avoid special characters.
      Just respond with the filename, nothing else.`;

      // Make the API call to Ollama
      const response = await this.client.generate({
        model: this.modelName,
        prompt: prompt,
        images: [base64Image],
        options: {
          temperature: 0.3,
          num_predict: 50
        }
      });

      if (!response || !response.response) {
        throw new Error('No response from Ollama');
      }

      const text = response.response.trim();
      const cleanedText = cleanFilename(text);
      
      logger.info(`AI Analysis: "${cleanedText}"`);
      return cleanedText;

    } catch (error) {
      logger.error('Error analyzing image with Ollama:', error);
      
      // Fallback to timestamp-based naming
      return getFallbackName(imagePath);
    }
  }

  // Method to test API connection
  async testConnection() {
    try {
      // Test with a simple text prompt
      const response = await this.client.generate({
        model: this.modelName,
        prompt: 'Hello, respond with "API working"',
        options: {
          num_predict: 10,
          temperature: 0.1
        }
      });

      if (!response || !response.response) {
        throw new Error('No response from Ollama');
      }
      
      return { 
        success: true, 
        message: 'Ollama connection successful',
        response: response.response
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Method to list available models
  async listModels() {
    try {
      const models = await this.client.list();
      return models.models || [];
    } catch (error) {
      logger.error('Error listing Ollama models:', error);
      return [];
    }
  }

  // Method to check if a specific model exists
  async hasModel(modelName) {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName || model.name.startsWith(modelName));
    } catch (error) {
      logger.error('Error checking for model:', error);
      return false;
    }
  }

  // Method to pull a model if it doesn't exist
  async ensureModel(modelName = null) {
    const targetModel = modelName || this.modelName;
    
    try {
      const hasModel = await this.hasModel(targetModel);
      if (hasModel) {
        logger.info(`Model ${targetModel} is available`);
        return true;
      }

      logger.info(`Pulling model ${targetModel}...`);
      await this.client.pull({ model: targetModel });
      logger.info(`Model ${targetModel} pulled successfully`);
      return true;
    } catch (error) {
      logger.error(`Error ensuring model ${targetModel}:`, error);
      return false;
    }
  }

  // Update configuration and reinitialize
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initializeAPI();
  }
}

module.exports = OllamaAnalyzer;