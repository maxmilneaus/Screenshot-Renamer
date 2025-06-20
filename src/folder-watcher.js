const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const geminiAnalyzer = require('./gemini-vision');
const clipboardManager = require('./clipboard-manager');
const config = require('./config');

class FolderWatcher {
  constructor() {
    this.watcher = null;
    this.config = config.load();
    this.imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    this.processingFiles = new Set();
  }

  start() {
    if (this.watcher) {
      console.log('Watcher already running');
      return;
    }

    const watchFolder = this.config.watchFolder;
    
    if (!fs.existsSync(watchFolder)) {
      console.error(`Watch folder does not exist: ${watchFolder}`);
      return;
    }

    console.log(`Starting to watch folder: ${watchFolder}`);

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
      .on('error', (error) => console.error('Watcher error:', error))
      .on('ready', () => console.log('File watcher ready'));
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('File watcher stopped');
    }
  }

  async handleNewFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath, ext);
      
      if (!this.imageExtensions.includes(ext)) {
        return; // Not an image file
      }

      // Skip if already processed (has AI-generated name pattern)
      if (fileName.match(/^[a-z_]+(_\d+)?$/)) {
        console.log(`Skipping already processed file: ${path.basename(filePath)}`);
        return;
      }

      if (this.processingFiles.has(filePath)) {
        return; // Already processing this file
      }

      this.processingFiles.add(filePath);
      
      console.log(`New image detected: ${path.basename(filePath)}`);
      
      // Wait a bit to ensure file is fully written
      await this.delay(500);
      
      // Analyze image with AI
      const analysis = await geminiAnalyzer.analyzeImage(filePath);
      
      if (!analysis) {
        console.error('Failed to analyze image');
        this.processingFiles.delete(filePath);
        return;
      }

      // Generate new filename
      const newFileName = this.generateFileName(analysis, ext);
      const newFilePath = path.join(path.dirname(filePath), newFileName);
      
      // Rename file
      if (filePath !== newFilePath) {
        fs.renameSync(filePath, newFilePath);
        console.log(`Renamed: ${path.basename(filePath)} → ${newFileName}`);
        
        // Copy to clipboard if enabled
        if (this.config.copyToClipboard) {
          await clipboardManager.copyImageToClipboard(newFilePath);
          console.log('Image copied to clipboard');
        }
        
        // Show notification if enabled
        if (this.config.showNotifications) {
          this.showNotification(`Renamed & copied: ${newFileName}`);
        }
      }
      
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    } finally {
      this.processingFiles.delete(filePath);
    }
  }

  generateFileName(analysis, extension) {
    // Clean up the analysis text to make it filename-safe
    let fileName = analysis
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Remove multiple underscores
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Shorter length
    
    // Only add timestamp if filename would be too generic or empty
    if (!fileName || fileName.length < 3 || fileName === 'image' || fileName === 'screenshot') {
      const timestamp = Date.now();
      return `${fileName || 'image'}_${timestamp}${extension}`;
    }
    
    return `${fileName}${extension}`;
  }

  showNotification(message) {
    try {
      const { execSync } = require('child_process');
      const script = `osascript -e 'display notification "${message}" with title "Screenshot Renamer"'`;
      execSync(script);
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
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
}

module.exports = FolderWatcher;