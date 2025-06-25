const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https');
const logger = require('./logger');

class GeminiModels {
  constructor() {
    this.genAI = null;
    this.apiKey = null;
    this.cachedModels = null;
    this.cacheTime = null;
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  }

  async initialize(apiKey) {
    try {
      this.apiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
      return true;
    } catch (error) {
      logger.error('Failed to initialize Gemini API:', error);
      return false;
    }
  }

  async getAvailableModels(apiKey) {
    // Initialize if not done already
    if (!this.genAI) {
      const initialized = await this.initialize(apiKey);
      if (!initialized) return this.getFallbackModels();
    }

    // Return cached models if still valid
    if (this.cachedModels && this.cacheTime && 
        (Date.now() - this.cacheTime < this.CACHE_DURATION)) {
      return this.cachedModels;
    }

    try {
      // Try to fetch available models from API
      const models = await this.fetchModelsFromAPI();
      
      // Cache the results
      this.cachedModels = models;
      this.cacheTime = Date.now();
      
      return models;
    } catch (error) {
      logger.error('Failed to fetch models from API:', error);
      return this.getFallbackModels();
    }
  }

  async fetchModelsFromAPI() {
    try {
      if (!this.apiKey) {
        throw new Error('API key is required');
      }

      // Use the official Gemini API models.list endpoint
      const data = await this.makeAPIRequest(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );
      
      // Enhanced model filtering - more flexible for vision capabilities
      const visionModels = data.models
        .filter(model => {
          if (!model.supportedGenerationMethods?.includes('generateContent')) {
            return false;
          }
          
          if (!model.inputTokenLimit) {
            return false;
          }
          
          // Broader vision model detection
          const hasVisionCapability = 
            model.name.includes('vision') || 
            model.name.includes('gemini-1.5') || 
            model.name.includes('gemini-2') ||
            model.name.includes('flash') ||
            model.name.includes('pro');
            
          return hasVisionCapability;
        })
        .map(model => {
          try {
            return this.formatAPIModel(model);
          } catch (formatError) {
            logger.warn(`Failed to format model ${model.name}:`, formatError);
            return null;
          }
        })
        .filter(model => model !== null); // Remove failed formatting attempts

      if (visionModels.length === 0) {
        logger.warn('No vision-capable models found in API response, using curated list');
        return this.getCuratedModels();
      }

      return visionModels;
    } catch (error) {
      logger.error('Failed to fetch models from API:', error);
      return this.getCuratedModels();
    }
  }

  formatAPIModel(apiModel) {
    const modelName = apiModel.name.replace('models/', '');
    const isExperimental = modelName.includes('exp') || modelName.includes('experimental');
    const isLegacy = modelName.includes('pro-vision') || modelName.includes('1.0');
    
    return {
      name: modelName,
      displayName: apiModel.displayName || modelName,
      description: apiModel.description || 'Vision-capable model',
      vision: true,
      pricing: {
        inputTokens: this.estimatePricing(modelName),
        note: this.getPricingNote(modelName)
      },
      recommended: modelName.includes('2.0-flash') && !isExperimental,
      experimental: isExperimental,
      legacy: isLegacy,
      inputTokenLimit: apiModel.inputTokenLimit,
      outputTokenLimit: apiModel.outputTokenLimit
    };
  }

  estimatePricing(modelName) {
    if (modelName.includes('1.5-flash') || modelName.includes('2.0-flash')) {
      return 'Free tier available';
    } else if (modelName.includes('1.5-pro') || modelName.includes('2.0-pro')) {
      return 'Paid tier';
    }
    return 'Check pricing';
  }

  getPricingNote(modelName) {
    if (modelName.includes('exp') || modelName.includes('experimental')) {
      return 'Experimental - may have usage limits';
    } else if (modelName.includes('flash')) {
      return 'Fast and cost-effective';
    } else if (modelName.includes('pro')) {
      return 'Higher accuracy, more expensive';
    }
    return 'Check current pricing at ai.google.dev/pricing';
  }

  makeAPIRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // Validate response status
            if (res.statusCode !== 200) {
              reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
              return;
            }

            const jsonData = JSON.parse(data);
            
            // Validate response structure
            if (!jsonData || typeof jsonData !== 'object') {
              reject(new Error('Invalid response format'));
              return;
            }

            if (!jsonData.models || !Array.isArray(jsonData.models)) {
              reject(new Error('Invalid response: missing models array'));
              return;
            }

            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  getCuratedModels() {
    return [
      {
        name: 'gemini-2.5-flash-lite-preview-06-17',
        displayName: 'Gemini 2.5 Flash Lite (Preview)',
        description: 'Latest preview model with enhanced vision capabilities',
        vision: true,
        pricing: {
          inputTokens: 'Free tier available',
          note: 'Check current pricing at ai.google.dev/pricing'
        },
        recommended: true
      },
      {
        name: 'gemini-2.5-flash-lite-preview-06-17',
        displayName: 'Gemini 2.5 Flash Lite (Preview)',
        description: 'Latest preview model with enhanced vision capabilities',
        vision: true,
        pricing: {
          inputTokens: 'Free tier available',
          note: 'Check current pricing at ai.google.dev/pricing'
        },
        recommended: true
      },
      {
        name: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash (Experimental)',
        description: 'Previous experimental model with vision capabilities',
        vision: true,
        pricing: {
          inputTokens: 'Free tier available',
          note: 'Check current pricing at ai.google.dev/pricing'
        }
      },
      {
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        description: 'High-performance model with extensive context window',
        vision: true,
        pricing: {
          inputTokens: 'Paid tier',
          note: 'Higher accuracy, longer context'
        }
      },
      {
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        description: 'Fast and efficient for most vision tasks',
        vision: true,
        pricing: {
          inputTokens: 'Free tier available',
          note: 'Good balance of speed and accuracy'
        }
      },
      {
        name: 'gemini-pro-vision',
        displayName: 'Gemini Pro Vision (Legacy)',
        description: 'Previous generation vision model',
        vision: true,
        pricing: {
          inputTokens: 'Free tier available',
          note: 'Stable but older model'
        },
        legacy: true
      }
    ];
  }

  getFallbackModels() {
    return [
      {
        name: 'gemini-2.5-flash-lite-preview-06-17',
        displayName: 'Gemini 2.5 Flash Lite (Preview)',
        description: 'Default model (offline mode)',
        vision: true,
        pricing: {
          inputTokens: 'Unknown',
          note: 'Unable to fetch current pricing'
        },
        recommended: true
      },
      {
        name: 'gemini-2.0-flash-exp',
        displayName: 'Gemini 2.0 Flash (Experimental)',
        description: 'Fallback model (offline mode)',
        vision: true,
        pricing: {
          inputTokens: 'Unknown',
          note: 'Unable to fetch current pricing'
        }
      }
    ];
  }

  async testModel(apiKey, modelName) {
    try {
      if (!this.genAI) {
        await this.initialize(apiKey);
      }
      
      const model = this.genAI.getGenerativeModel({ model: modelName });
      
      // Simple test to see if model is accessible
      const result = await model.generateContent("Test");
      return { success: true, model: modelName };
    } catch (error) {
      return { 
        success: false, 
        model: modelName, 
        error: error.message 
      };
    }
  }

  categorizeModels(models) {
    const recommended = [];
    const experimental = [];
    const legacy = [];
    const specialized = [];

    models.forEach(model => {
      if (this.isRecommended(model)) {
        recommended.push(model);
      } else if (this.isExperimental(model)) {
        experimental.push(model);
      } else if (this.isLegacy(model)) {
        legacy.push(model);
      } else {
        specialized.push(model);
      }
    });

    return {
      recommended: recommended.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)),
      experimental: experimental.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      legacy: legacy.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      specialized: specialized.sort((a, b) => a.displayName.localeCompare(b.displayName))
    };
  }

  isRecommended(model) {
    // Stable, good performance, reasonable cost
    return !model.name.includes('exp') && 
           !model.name.includes('experimental') &&
           (model.name.includes('flash') || model.name.includes('2.0')) &&
           !model.legacy;
  }

  isExperimental(model) {
    return model.name.includes('exp') || 
           model.name.includes('experimental') ||
           model.experimental === true;
  }

  isLegacy(model) {
    return model.name.includes('pro-vision') || 
           model.name.includes('1.0') ||
           model.legacy === true;
  }

  getModelRecommendations() {
    return {
      speed: 'gemini-1.5-flash',
      accuracy: 'gemini-1.5-pro', 
      experimental: 'gemini-2.0-flash-exp',
      free: 'gemini-1.5-flash'
    };
  }

  formatModelChoices(category = 'recommended') {
    // Use cached models if available, otherwise fall back to curated
    const allModels = this.cachedModels || this.getCuratedModels();
    const categorized = this.categorizeModels(allModels);
    
    let models;
    switch (category) {
      case 'all':
        models = allModels;
        break;
      case 'experimental':
        models = [...categorized.recommended, ...categorized.experimental];
        break;
      case 'legacy':
        models = [...categorized.recommended, ...categorized.legacy];
        break;
      case 'recommended':
      default:
        models = categorized.recommended.length > 0 ? categorized.recommended : allModels.slice(0, 3);
        break;
    }
    
    return models.map(model => ({
      name: model.displayName,
      value: model.name,
      short: model.displayName
    }));
  }

  getProgressiveChoices() {
    const allModels = this.cachedModels || this.getCuratedModels();
    const categorized = this.categorizeModels(allModels);
    
    const choices = [];
    
    // Add recommended models with clean names
    if (categorized.recommended.length > 0) {
      categorized.recommended.forEach(model => {
        choices.push({
          name: model.displayName,
          value: model.name,
          short: model.displayName
        });
      });
    }
    
    // Add expansion options
    if (categorized.experimental.length > 0) {
      choices.push({
        name: '🧪 Show experimental models',
        value: 'show_experimental',
        short: 'Experimental'
      });
    }
    
    if (categorized.legacy.length > 0) {
      choices.push({
        name: '📜 Show legacy models',
        value: 'show_legacy',
        short: 'Legacy'
      });
    }
    
    choices.push({
      name: '📋 Show all models',
      value: 'show_all',
      short: 'All models'
    });
    
    return choices;
  }
}

module.exports = new GeminiModels();