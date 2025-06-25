const fs = require('fs');
const fetch = require('node-fetch');
const logger = require('./logger');
const { getMimeType, cleanFilename, getFallbackName } = require('./ai-utils');

class LMStudioVisionAnalyzer {
  constructor(config = null) {
    this.baseUrl = null;
    this.modelName = null;
    this.config = config;
    
    if (config) {
      this.initializeAPI();
    }
  }

  initializeAPI() {
    if (!this.config) {
      logger.error('No configuration provided to LMStudioVisionAnalyzer');
      return;
    }

    this.baseUrl = this.config.lmstudioBaseUrl || 'http://localhost:1234';
    this.modelName = this.config.lmstudioModel || 'gemma3:4b';
    
    logger.debug(`LM Studio configured: ${this.baseUrl}`);
  }

  async analyzeImage(imagePath) {
    try {
      // Read the image file
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = getMimeType(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Prepare the prompt for naming
      const prompt = `Analyze this image and provide a short, descriptive filename (without extension) that would be suitable for organizing this image. 
      Focus on the main subject, action, or content of the image. 
      Use clear, simple words separated by underscores.
      Examples: "login_screen", "dashboard_overview", "error_message", "user_profile", "mobile_menu"
      Keep it under 50 characters and avoid special characters.
      Just respond with the filename, nothing else.`;

      // Prepare the request payload for LM Studio
      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: this.config.lmstudioMaxTokens || 50,
        temperature: this.config.lmstudioTemperature || 0.1,
        top_p: 0.8,              // Focus on most likely tokens
        frequency_penalty: 0.1,   // Slight penalty to avoid repetition
        presence_penalty: 0.1,    // Encourage conciseness
        stop: ["\n", ".", "!"]   // Stop on common sentence endings
      };

      // Make the API call to LM Studio
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from LM Studio');
      }

      const text = data.choices[0].message.content.trim();
      const cleanedText = cleanFilename(text);
      
      logger.debug(`AI Analysis: "${cleanedText}"`);
      return cleanedText;

    } catch (error) {
      logger.error('Error analyzing image with LM Studio:', error);
      
      // Fallback to timestamp-based naming
      return getFallbackName(imagePath);
    }
  }


  // Method to test API connection
  async testConnection() {
    try {
      // Test with a simple text prompt
      const requestBody = {
        model: this.modelName,
        messages: [
          {
            role: "user",
            content: "Hello, respond with 'API working'"
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      };

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return { 
        success: true, 
        message: 'LM Studio connection successful',
        response: data.choices?.[0]?.message?.content || 'Connected'
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

module.exports = LMStudioVisionAnalyzer;