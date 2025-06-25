const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const logger = require('./logger');
const { getMimeType, cleanFilename, getFallbackName } = require('./ai-utils');

class GeminiVisionAnalyzer {
  constructor(config = null) {
    this.genAI = null;
    this.model = null;
    this.config = config;
    
    if (config) {
      this.initializeAPI();
    }
  }

  initializeAPI() {
    if (!this.config) {
      logger.error('No configuration provided to GeminiVisionAnalyzer');
      return;
    }

    const apiKey = this.config.geminiApiKey;
    if (!apiKey) {
      logger.error('Gemini API key not configured');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      const modelName = this.config.geminiModel || 'gemini-2.0-flash-exp';
      this.model = this.genAI.getGenerativeModel({ model: modelName });
      logger.info('Gemini API initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini API:', error);
    }
  }

  async analyzeImage(imagePath) {
    if (!this.model) {
      logger.error('Gemini API not initialized');
      return null;
    }

    try {
      // Read the image file
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = getMimeType(imagePath);
      
      // Prepare the image data for Gemini
      const imageParts = [{
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      }];

      // Create a descriptive prompt for naming
      const prompt = `Analyze this image and provide a short, descriptive filename (without extension) that would be suitable for organizing this image. 
      Focus on the main subject, action, or content of the image. 
      Use clear, simple words separated by underscores.
      Examples: "login_screen", "dashboard_overview", "error_message", "user_profile", "mobile_menu"
      Keep it under 50 characters and avoid special characters.
      Just respond with the filename, nothing else.`;

      // Generate content
      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text().trim();

      // Clean up the response
      const cleanedText = cleanFilename(text);
      
      logger.info(`AI Analysis: "${cleanedText}"`);
      return cleanedText;

    } catch (error) {
      logger.error('Error analyzing image with Gemini:', error);
      
      // Fallback to timestamp-based naming
      return getFallbackName(imagePath);
    }
  }


  // Method to test API connection
  async testConnection() {
    if (!this.model) {
      return { success: false, error: 'API not initialized' };
    }

    try {
      // Test with a simple text prompt
      const result = await this.model.generateContent('Hello, respond with "API working"');
      const response = await result.response;
      const text = response.text();
      
      return { 
        success: true, 
        message: 'API connection successful',
        response: text 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // Update configuration and reinitialize
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initializeAPI();
  }
}

module.exports = GeminiVisionAnalyzer;