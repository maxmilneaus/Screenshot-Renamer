const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { z } = require('zod');

// Define base configuration schema
const BaseConfigSchema = z.object({
  watchFolder: z.string()
    .min(1, 'Watch folder path cannot be empty')
    .refine(
      (path) => fs.existsSync(path), 
      'Watch folder must exist'
    ),
  copyToClipboard: z.boolean()
    .default(true),
  showNotifications: z.boolean()
    .default(true),
  logLevel: z.enum(['error', 'warn', 'info', 'debug'])
    .default('info'),
  maxRetries: z.number()
    .int()
    .min(0)
    .max(5)
    .default(3),
  retryDelay: z.number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000),
  aiProvider: z.enum(['gemini', 'lmstudio', 'ollama'])
    .default('gemini')
});

// Define configuration schema with conditional validation
const ConfigSchema = BaseConfigSchema.and(
  z.discriminatedUnion('aiProvider', [
    z.object({
      aiProvider: z.literal('gemini'),
      geminiApiKey: z.string()
        .min(1, 'Gemini API key is required')
        .regex(/^AIza[A-Za-z0-9_-]{35}$/, 'Invalid Gemini API key format'),
      geminiModel: z.string()
        .default('gemini-2.0-flash-exp'),
      // Optional LM Studio fields for gemini provider
      lmstudioBaseUrl: z.string().optional(),
      lmstudioModel: z.string().optional()
    }),
    z.object({
      aiProvider: z.literal('lmstudio'),
      lmstudioBaseUrl: z.string()
        .url('Invalid LM Studio base URL')
        .default('http://localhost:1234'),
      lmstudioModel: z.string()
        .min(1, 'LM Studio model name is required')
        .default('gemma3:4b'),
      lmstudioMaxTokens: z.number()
        .int()
        .min(10)
        .max(200)
        .default(50),
      lmstudioTemperature: z.number()
        .min(0)
        .max(1)
        .default(0.1),
      // Optional Gemini fields for lmstudio provider
      geminiApiKey: z.string().optional(),
      geminiModel: z.string().optional()
    }),
    z.object({
      aiProvider: z.literal('ollama'),
      ollamaBaseUrl: z.string()
        .url('Invalid Ollama base URL')
        .default('http://localhost:11434'),
      ollamaModel: z.string()
        .min(1, 'Ollama model name is required')
        .default('gemma3:4b')
    })
  ])
);

class Config {
  constructor() {
    this.configPath = path.join(os.homedir(), '.screenshot-renamer-config.json');
    this.schema = ConfigSchema;
    this.defaultConfig = {
      watchFolder: this.getDefaultScreenshotPath(),
      geminiApiKey: '', // Ensure this is an empty string for unconfigured state
      copyToClipboard: true,
      showNotifications: true,
      logLevel: 'info',
      geminiModel: 'gemini-2.5-flash-lite-preview-06-17',
      maxRetries: 3,
      retryDelay: 5000,
      lmstudioBaseUrl: 'http://localhost:1234',
      lmstudioModel: 'lmstudio-community/gemma-3-4b-it-qat',
      lmstudioMaxTokens: 50,
      lmstudioTemperature: 0.1,
      aiProvider: 'lmstudio',
      ollamaModel: 'gemma3:4b'
    };
  }

  getDefaultScreenshotPath() {
    try {
      // Try to get macOS screenshot location
      const result = execSync('defaults read com.apple.screencapture location 2>/dev/null', { encoding: 'utf8' }).trim();
      if (result && fs.existsSync(result)) {
        return result;
      }
    } catch (error) {
      // Fallback to Desktop if can't read screenshot location
    }
    
    return path.join(os.homedir(), 'Desktop');
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return { ...this.defaultConfig, ...JSON.parse(configData) };
      }
    } catch (error) {
      // Note: logger not available during config loading, using console
    }
    
    return { ...this.defaultConfig };
  }

  save(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      // Note: logger not available during config save, using console
      return false;
    }
  }

  update(updates) {
    const current = this.load();
    const updated = { ...current, ...updates };
    return this.save(updated);
  }

  get(key) {
    const config = this.load();
    return key ? config[key] : config;
  }

  validate(config) {
    try {
      this.schema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => {
          const field = err.path.join('.');
          return `${field}: ${err.message}`;
        });
        return { valid: false, errors };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  validatePartial(updates) {
    try {
      // Allow partial validation for updates
      const partialSchema = this.schema.partial();
      partialSchema.parse(updates);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => {
          const field = err.path.join('.');
          return `${field}: ${err.message}`;
        });
        return { valid: false, errors };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  // Enhanced validation with helpful error messages
  validateForSetup(config) {
    const result = this.validate(config);
    
    if (!result.valid) {
      // Add helpful setup guidance
      const enhancedErrors = result.errors.map(error => {
        if (error.includes('watchFolder')) {
          return `${error}\n  💡 Try using: ${this.getDefaultScreenshotPath()}`;
        }
        if (error.includes('geminiApiKey')) {
          return `${error}\n  💡 Get your API key from: https://aistudio.google.com/apikey`;
        }
        return error;
      });
      
      return { valid: false, errors: enhancedErrors };
    }
    
    return result;
  }
}

module.exports = new Config();