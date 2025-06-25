const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const AnalyzerFactory = require('./analyzers/analyzer-factory');
const clipboardManager = require('./clipboard-manager');
const config = require('./config');
const logger = require('./logger');

class FolderWatcher {
  constructor() {
    this.watcher = null;
    this.config = config.load();
    this.imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    this.processingFiles = new Set();
    this.timingData = new Map(); // Store timing comparisons
  }

  formatTime(ms) {
    return `${(ms / 1000).toFixed(1)} seconds`;
  }

  getAnalyzer() {
    return AnalyzerFactory.createAnalyzer(this.config);
  }

  start() {
    if (this.watcher) {
      logger.warn('Watcher service already running');
      return;
    }

    this.reloadConfig(); // Ensure latest config is loaded
    const watchFolder = this.config.watchFolder;
    
    if (!watchFolder || !fs.existsSync(watchFolder)) {
      logger.error(`Watch folder is invalid or not configured: ${watchFolder}`);
      return;
    }

    logger.info(`Starting to watch folder: ${watchFolder}`);

    this.watcher = chokidar.watch(watchFolder, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (filePath) => this.handleNewFile(filePath))
      .on('error', (error) => logger.error('Watcher error', error))
      .on('ready', () => logger.info('File watcher ready'));
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('File watcher stopped');
    }
  }

  async handleNewFile(filePath) {
    logger.info(`New file detected: ${filePath}`);
    try {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath, ext);
      
      if (!this.imageExtensions.includes(ext)) {
        logger.debug(`Skipping non-image file: ${filePath}`);
        return;
      }

      // Skip if already processed (has a clear AI-generated name pattern)
      // This now requires at least one underscore to be considered "processed"
      if (fileName.includes('_') && /^[a-z_]+(_\d+)?$/.test(fileName)) {
        logger.info(`⏭️ Skipping already processed file: ${path.basename(filePath)}`);
        return;
      }

      if (this.processingFiles.has(filePath)) {
        logger.warn(`File is already being processed, skipping: ${path.basename(filePath)}`);
        return;
      }

      this.processingFiles.add(filePath);
      
      // Debounce to handle rapid-fire events
      await this.delay(250);

      // Verify file still exists before processing
      if (!fs.existsSync(filePath)) {
        logger.warn(`File no longer exists, likely already processed: ${path.basename(filePath)}`);
        this.processingFiles.delete(filePath);
        return;
      }
      
      logger.info(`New image detected: ${path.basename(filePath)}`);
      
      // Reload config to pick up any changes
      this.reloadConfig();
      
      // Analyze image with AI
      const aiProvider = this.config.aiProvider;
      let modelName;
      if (aiProvider === 'lmstudio') {
        modelName = this.config.lmstudioModel;
      } else if (aiProvider === 'ollama') {
        modelName = this.config.ollamaModel;
      } else {
        modelName = this.config.geminiModel;
      }
      const startTime = Date.now();
      
      logger.info(`🤖 Starting AI analysis`, {
        provider: aiProvider,
        model: modelName,
        file: path.basename(filePath)
      });
      
      const analyzer = this.getAnalyzer();
      const analysis = await analyzer.analyzeImage(filePath);
      
      const endTime = Date.now();
      const timeTaken = endTime - startTime;
      
      if (!analysis) {
        logger.error('❌ Image analysis failed, no result returned', { 
          file: filePath,
          provider: aiProvider,
          model: modelName,
          timeTaken: this.formatTime(timeTaken)
        });
        this.processingFiles.delete(filePath);
        return;
      }
      
      logger.info(`✅ Image analysis successful`, {
        result: analysis,
        provider: aiProvider,
        model: modelName,
        timeTaken: this.formatTime(timeTaken),
        file: path.basename(filePath)
      });
      
      // Store timing data for comparison
      this.recordTiming(aiProvider, modelName, timeTaken);

      // Generate new filename
      const newFileName = await this.generateFileName(analysis, ext);
      const newFilePath = path.join(path.dirname(filePath), newFileName);
      
      // Rename file
      if (filePath !== newFilePath) {
        logger.info(`Attempting to rename: ${filePath} -> ${newFilePath}`);
        try {
          await fs.promises.rename(filePath, newFilePath);
          logger.info(`✅ File renamed successfully: ${path.basename(filePath)} → ${newFileName}`);

          // Copy to clipboard if enabled
          if (this.config.copyToClipboard) {
            logger.info('📋 Copying to clipboard...');
            await clipboardManager.copyImageToClipboard(newFilePath);
            logger.info('✅ Image copied to clipboard');
          }
        } catch (renameError) {
          logger.error(`❌ Error renaming file: ${filePath} to ${newFilePath}`, renameError);
        }
      } else {
        logger.warn(`Skipping rename, as new and old file paths are identical: ${filePath}`);
      }
      
    } catch (error) {
      logger.error(`Error processing file ${filePath}`, error);
    } finally {
      this.processingFiles.delete(filePath);
    }
  }

  async generateFileName(analysis, extension) {
    // Clean up the analysis text to make it filename-safe
    let fileName = analysis
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Remove multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Shorter length
    
    logger.debug(`Cleaned analysis to: "${fileName}"`);

    // Only add timestamp if filename would be too generic or empty
    if (!fileName || fileName.length < 3 || fileName === 'image' || fileName === 'screenshot') {
      const timestamp = Date.now();
      const newName = `${fileName || 'image'}_${timestamp}${extension}`;
      logger.warn(`Analysis result was generic or empty. Using timestamp-based name: ${newName}`);
      return newName;
    }
    
    // Handle potential filename conflicts
    let counter = 1;
    let newFileName = `${fileName}${extension}`;
    const dir = this.config.watchFolder;
    
    while (true) {
      const fullPath = path.join(dir, newFileName);
      logger.debug(`Checking for file existence: ${fullPath}`);
      try {
        await fs.promises.access(fullPath);
        // If access doesn't throw, file exists. Try next name.
        counter++;
        newFileName = `${fileName}_${counter}${extension}`;
        logger.warn(`File conflict found. Trying next name: ${newFileName}`);
      } catch (e) {
        // If access throws, file does not exist. We're good.
        logger.debug(`No file conflict found for: ${newFileName}`);
        break;
      }
    }
    
    logger.info(`Generated new filename: ${newFileName}`);
    return newFileName;
  }


  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    config.save(this.config);
    
    // Restart watcher if folder changed
    if (newConfig.watchFolder && newConfig.watchFolder !== this.config.watchFolder) {
      this.stop();
      this.start();
    }
  }

  reloadConfig() {
    const oldProvider = this.config.aiProvider;
    this.config = config.load();
    const newProvider = this.config.aiProvider;
    
    if (oldProvider !== newProvider) {
      logger.info(`🔄 AI Provider changed: ${oldProvider} → ${newProvider}`);
    }
  }

  recordTiming(provider, model, timeTaken) {
    const key = `${provider}:${model}`;
    if (!this.timingData.has(key)) {
      this.timingData.set(key, []);
    }
    
    const timings = this.timingData.get(key);
    timings.push(timeTaken);
    
    // Keep only last 10 measurements to avoid memory bloat
    if (timings.length > 10) {
      timings.shift();
    }
    
    // Log comparison every 3rd analysis
    if (timings.length % 3 === 0) {
      this.logTimingComparison();
    }
  }

  logTimingComparison() {
    if (this.timingData.size === 0) return;
    
    logger.info(`📊 Performance Comparison`);
    
    for (const [key, timings] of this.timingData) {
      const [provider, model] = key.split(':');
      const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
      const min = Math.min(...timings);
      const max = Math.max(...timings);
      const latest = timings[timings.length - 1];
      
      const providerType = provider === 'lmstudio' ? '🏠 On-device' : '☁️  Cloud';
      
      logger.info(`${providerType} - ${model}`, {
        latest: this.formatTime(latest),
        average: this.formatTime(avg),
        range: `${this.formatTime(min)}-${this.formatTime(max)}`,
        samples: timings.length
      });
    }
    
    // Show speed comparison if we have both providers
    const lmstudioKeys = Array.from(this.timingData.keys()).filter(k => k.startsWith('lmstudio:'));
    const geminiKeys = Array.from(this.timingData.keys()).filter(k => k.startsWith('gemini:'));
    
    if (lmstudioKeys.length > 0 && geminiKeys.length > 0) {
      const lmstudioAvg = this.getAverageForProvider('lmstudio');
      const geminiAvg = this.getAverageForProvider('gemini');
      
      if (lmstudioAvg && geminiAvg) {
        const faster = lmstudioAvg < geminiAvg ? 'On-device' : 'Cloud';
        const speedDiff = Math.abs(lmstudioAvg - geminiAvg);
        const percentDiff = Math.round((speedDiff / Math.max(lmstudioAvg, geminiAvg)) * 100);
        
        logger.info(`🚀 Speed Winner: ${faster} is ${percentDiff}% faster (${this.formatTime(speedDiff)} difference)`);
      }
    }
  }

  getAverageForProvider(provider) {
    const keys = Array.from(this.timingData.keys()).filter(k => k.startsWith(`${provider}:`));
    if (keys.length === 0) return null;
    
    let totalTime = 0;
    let totalSamples = 0;
    
    for (const key of keys) {
      const timings = this.timingData.get(key);
      totalTime += timings.reduce((a, b) => a + b, 0);
      totalSamples += timings.length;
    }
    
    return Math.round(totalTime / totalSamples);
  }
}

module.exports = FolderWatcher;