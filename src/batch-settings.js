const fs = require('fs');
const path = require('path');
const os = require('os');

class BatchSettings {
  constructor() {
    this.settingsPath = path.join(os.homedir(), '.screenshot-renamer-batch-settings.json');
    this.defaultSettings = {
      lastUsedFolder: os.homedir(),
      defaultPrefix: '',
      filenameFormat: '{description}', // {description}, {prefix}_{description}, {prefix}-{description}, {date}_{prefix}_{description}
      separator: '_',
      processMode: 'rename', // 'rename', 'copy', 'preview'
      copyDestination: '',
      skipProcessed: true,
      copyToClipboard: false, // Different from main app - batch usually doesn't need clipboard
      createBackup: true,
      fileTypes: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
      templates: {
        'Web Design': {
          prefix: 'web',
          format: '{prefix}_{description}',
          separator: '_'
        },
        'App Screenshots': {
          prefix: 'app',
          format: '{prefix}-{description}',
          separator: '-'
        },
        'Documentation': {
          prefix: 'docs',
          format: '{date}_{prefix}_{description}',
          separator: '_'
        }
      }
    };
  }

  load() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const settings = JSON.parse(data);
        
        // Merge with defaults to ensure all properties exist
        return { ...this.defaultSettings, ...settings };
      }
    } catch (error) {
      console.warn('Failed to load batch settings, using defaults:', error.message);
    }
    
    return { ...this.defaultSettings };
  }

  save(settings) {
    try {
      const mergedSettings = { ...this.load(), ...settings };
      fs.writeFileSync(this.settingsPath, JSON.stringify(mergedSettings, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save batch settings:', error.message);
      return false;
    }
  }

  getTemplate(templateName) {
    const settings = this.load();
    return settings.templates[templateName] || null;
  }

  saveTemplate(templateName, templateSettings) {
    const settings = this.load();
    settings.templates[templateName] = templateSettings;
    return this.save(settings);
  }

  getAvailableTemplates() {
    const settings = this.load();
    return Object.keys(settings.templates);
  }

  reset() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        fs.unlinkSync(this.settingsPath);
      }
      return true;
    } catch (error) {
      console.error('Failed to reset batch settings:', error.message);
      return false;
    }
  }

  validateSettings(settings) {
    const errors = [];

    // Validate folder paths
    if (settings.lastUsedFolder && !fs.existsSync(settings.lastUsedFolder)) {
      errors.push('Last used folder does not exist');
    }

    if (settings.copyDestination && settings.processMode === 'copy' && !fs.existsSync(settings.copyDestination)) {
      errors.push('Copy destination folder does not exist');
    }

    // Validate filename format
    const validFormats = ['{description}', '{prefix}_{description}', '{prefix}-{description}', '{date}_{prefix}_{description}'];
    if (!validFormats.includes(settings.filenameFormat)) {
      errors.push('Invalid filename format');
    }

    // Validate process mode
    const validModes = ['rename', 'copy', 'preview'];
    if (!validModes.includes(settings.processMode)) {
      errors.push('Invalid process mode');
    }

    // Validate file types
    if (!Array.isArray(settings.fileTypes) || settings.fileTypes.length === 0) {
      errors.push('At least one file type must be specified');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  generateFilename(analysis, originalExt, settings) {
    const { filenameFormat, defaultPrefix, separator } = settings;
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Clean up the analysis text
    let description = analysis
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, separator)
      .replace(new RegExp(`${separator}+`, 'g'), separator)
      .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')
      .substring(0, 50);

    // Handle empty or generic descriptions
    if (!description || description.length < 3 || description === 'image' || description === 'screenshot') {
      description = `image${separator}${Date.now()}`;
    }

    // Apply filename format
    let filename = filenameFormat
      .replace('{description}', description)
      .replace('{prefix}', defaultPrefix || 'img')
      .replace('{date}', currentDate)
      .replace('{separator}', separator);

    // Clean up any double separators
    filename = filename.replace(new RegExp(`${separator}+`, 'g'), separator);
    filename = filename.replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');

    return `${filename}${originalExt}`;
  }

  async findUniqueFilename(baseFilename, directory) {
    const ext = path.extname(baseFilename);
    const nameWithoutExt = path.basename(baseFilename, ext);
    
    let counter = 1;
    let filename = baseFilename;
    
    while (true) {
      try {
        await fs.promises.access(path.join(directory, filename));
        counter++;
        filename = `${nameWithoutExt}_${counter}${ext}`;
      } catch (e) {
        break;
      }
    }
    
    return filename;
  }

  getSettingsPath() {
    return this.settingsPath;
  }

  exportSettings() {
    const settings = this.load();
    return JSON.stringify(settings, null, 2);
  }

  importSettings(settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      const validation = this.validateSettings(settings);
      
      if (!validation.valid) {
        throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
      }
      
      return this.save(settings);
    } catch (error) {
      console.error('Failed to import settings:', error.message);
      return false;
    }
  }
}

module.exports = BatchSettings;