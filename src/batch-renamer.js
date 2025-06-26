#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AnalyzerFactory = require('./analyzers/analyzer-factory');
const clipboardManager = require('./clipboard-manager');
const config = require('./config');
const logger = require('./logger');

class BatchRenamer {
  constructor() {
    this.config = config.load();
    this.imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    this.processingResults = [];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAnalyzer() {
    return AnalyzerFactory.createAnalyzer(this.config);
  }

  async processFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    if (!fs.statSync(folderPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${folderPath}`);
    }

    // Validate configuration before processing
    const validation = config.validate(this.config);
    if (!validation.valid) {
      throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
    }

    console.log(`🚀 Starting batch rename for folder: ${folderPath}`);
    
    const files = await this.getImageFiles(folderPath);
    
    if (files.length === 0) {
      console.log('❌ No image files found in the specified folder.');
      return;
    }

    console.log(`📸 Found ${files.length} image files to process`);

    // Test API connection before processing
    const analyzer = this.getAnalyzer();
    const provider = this.config.aiProvider;
    console.log(`🧪 Testing ${provider} API connection...`);
    const apiTest = await analyzer.testConnection();
    
    if (!apiTest.success) {
      throw new Error(`${provider} API test failed: ${apiTest.error}`);
    }
    
    console.log(`✅ ${provider} API connection successful`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const fileNameWithoutExt = path.basename(filePath, ext);
        
        // Skip if already processed (has AI-generated name pattern)
        if (fileNameWithoutExt.match(/^[a-z_]+(_\d+)?$/)) {
          console.log(`⏭️  Skipping already processed: ${fileName}`);
          skipped++;
          continue;
        }

        console.log(`🤖 Processing: ${fileName}...`);
        
        // Wait for file stability (similar to folder-watcher)
        await this.delay(500);
        
        const startTime = Date.now();
        logger.info(`🤖 Starting AI analysis`, {
          provider: this.config.aiProvider,
          model: this.config.aiProvider === 'lmstudio' ? this.config.lmstudioModel : 
                 this.config.aiProvider === 'ollama' ? this.config.ollamaModel : this.config.geminiModel,
          file: fileName
        });
        
        const analysis = await analyzer.analyzeImage(filePath);
        const timeTaken = Date.now() - startTime;
        
        if (!analysis) {
          console.log(`❌ Analysis failed for: ${fileName}`);
          logger.error('❌ Image analysis failed, no result returned', { 
            file: filePath,
            provider: this.config.aiProvider,
            timeTaken: `${(timeTaken / 1000).toFixed(1)}s`
          });
          errors++;
          continue;
        }
        
        logger.info(`✅ Image analysis successful`, {
          result: analysis,
          provider: this.config.aiProvider,
          timeTaken: `${(timeTaken / 1000).toFixed(1)}s`,
          file: fileName
        });

        const newFileName = await this.generateFileName(analysis, ext, path.dirname(filePath));
        const newFilePath = path.join(path.dirname(filePath), newFileName);
        
        if (filePath !== newFilePath) {
          try {
            await fs.promises.rename(filePath, newFilePath);
            console.log(`✅ Renamed: ${fileName} → ${newFileName} (${(timeTaken / 1000).toFixed(1)}s)`);
            logger.info(`File renamed: ${fileName} → ${newFileName}`);
            processed++;
            
            // Copy to clipboard if enabled (matching folder-watcher behavior)
            if (this.config.copyToClipboard) {
              try {
                await clipboardManager.copyImageToClipboard(newFilePath);
                console.log(`📋 Copied to clipboard: ${newFileName}`);
                logger.info('Image copied to clipboard');
              } catch (clipboardError) {
                console.log(`⚠️  Clipboard copy failed for ${newFileName}: ${clipboardError.message}`);
                logger.warn('Clipboard copy failed', clipboardError);
              }
            }
            
            this.processingResults.push({
              originalName: fileName,
              newName: newFileName,
              analysis: analysis,
              timeTaken: timeTaken
            });
          } catch (renameError) {
            console.log(`❌ Failed to rename ${fileName}: ${renameError.message}`);
            logger.error(`Error renaming file: ${filePath} to ${newFilePath}`, renameError);
            errors++;
          }
        } else {
          console.log(`⏭️  No change needed: ${fileName}`);
          skipped++;
        }
        
      } catch (error) {
        console.log(`❌ Error processing ${path.basename(filePath)}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Batch processing complete:`);
    console.log(`   ✅ Processed: ${processed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    if (this.processingResults.length > 0) {
      const avgTime = this.processingResults.reduce((sum, r) => sum + r.timeTaken, 0) / this.processingResults.length;
      console.log(`   ⏱️  Average time: ${(avgTime / 1000).toFixed(1)}s per image`);
    }
  }

  async getImageFiles(folderPath) {
    const files = await fs.promises.readdir(folderPath);
    const imageFiles = [];
    
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stat = await fs.promises.stat(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (this.imageExtensions.includes(ext)) {
          imageFiles.push(fullPath);
        }
      }
    }
    
    return imageFiles.sort(); // Sort for consistent processing order
  }

  async generateFileName(analysis, extension, directory) {
    // Clean up the analysis text to make it filename-safe (matching folder-watcher logic)
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
    
    // Handle potential filename conflicts (use provided directory, not config.watchFolder)
    let counter = 1;
    let newFileName = `${fileName}${extension}`;
    
    while (true) {
      try {
        await fs.promises.access(path.join(directory, newFileName));
        // If access doesn't throw, file exists. Try next name.
        counter++;
        newFileName = `${fileName}_${counter}${extension}`;
      } catch (e) {
        // If access throws, file does not exist. We're good.
        break;
      }
    }
    
    return newFileName;
  }
}

// Handle command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npm run batch-rename <folder-path>');
    console.log('Example: npm run batch-rename ~/Desktop/screenshots');
    process.exit(1);
  }
  
  const folderPath = path.resolve(args[0]);
  const batchRenamer = new BatchRenamer();
  
  batchRenamer.processFolder(folderPath)
    .then(() => {
      console.log('\n🎉 Batch rename completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Batch rename failed:', error.message);
      process.exit(1);
    });
}

module.exports = BatchRenamer;