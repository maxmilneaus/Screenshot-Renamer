const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class GeminiVisionAnalyzer {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.initializeAPI();
  }

  initializeAPI() {
    const apiKey = config.get('geminiApiKey');
    if (!apiKey) {
      console.error('Gemini API key not configured');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      console.log('Gemini API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  }

  async analyzeImage(imagePath) {
    if (!this.model) {
      console.error('Gemini API not initialized');
      return null;
    }

    try {
      // Read the image file
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeType(imagePath);
      
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
      const cleanedText = this.cleanFilename(text);
      
      console.log(`AI Analysis: "${cleanedText}"`);
      return cleanedText;

    } catch (error) {
      console.error('Error analyzing image with Gemini:', error);
      
      // Fallback to timestamp-based naming
      return this.getFallbackName(imagePath);
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    return mimeTypes[ext] || 'image/jpeg';
  }

  cleanFilename(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Remove multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 50) // Limit length
      || 'analyzed_image'; // Fallback if cleaning results in empty string
  }

  getFallbackName(imagePath) {
    const basename = path.basename(imagePath, path.extname(imagePath));
    
    // If it looks like a screenshot, use that pattern
    if (basename.toLowerCase().includes('screenshot')) {
      return `screenshot_${Date.now()}`;
    }
    
    // Generic fallback
    return `image_${Date.now()}`;
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

  // Update API key and reinitialize
  updateAPIKey(newApiKey) {
    config.update({ geminiApiKey: newApiKey });
    this.initializeAPI();
  }
}

module.exports = new GeminiVisionAnalyzer();