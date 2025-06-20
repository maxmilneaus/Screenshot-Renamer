const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { z } = require('zod');

// Define configuration schema with validation
const ConfigSchema = z.object({
  watchFolder: z.string()
    .min(1, 'Watch folder path cannot be empty')
    .refine(
      (path) => fs.existsSync(path), 
      'Watch folder must exist'
    ),
  geminiApiKey: z.string()
    .min(1, 'Gemini API key is required')
    .regex(/^AIza[A-Za-z0-9_-]{35}$/, 'Invalid Gemini API key format'),
  copyToClipboard: z.boolean()
    .default(true),
  showNotifications: z.boolean()
    .default(true),
  logLevel: z.enum(['error', 'warn', 'info', 'debug'])
    .default('info'),
  geminiModel: z.string()
    .default('gemini-2.0-flash-exp'),
  maxRetries: z.number()
    .int()
    .min(0)
    .max(5)
    .default(3),
  retryDelay: z.number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000)
});

class Config {
  constructor() {
    this.configPath = path.join(os.homedir(), '.screenshot-renamer-config.json');
    this.schema = ConfigSchema;
    this.defaultConfig = {
      watchFolder: this.getDefaultScreenshotPath(),
      geminiApiKey: '',
      copyToClipboard: true,
      showNotifications: true,
      logLevel: 'info',
      geminiModel: 'gemini-2.0-flash-exp',
      maxRetries: 3,
      retryDelay: 5000
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
      console.warn('Error loading config, using defaults:', error.message);
    }
    
    return { ...this.defaultConfig };
  }

  save(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving config:', error.message);
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
          return `${error}\n  💡 Get your API key from: https://makersuite.google.com/app/apikey`;
        }
        return error;
      });
      
      return { valid: false, errors: enhancedErrors };
    }
    
    return result;
  }
}

module.exports = new Config();