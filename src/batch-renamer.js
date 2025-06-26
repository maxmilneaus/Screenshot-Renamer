#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const AnalyzerFactory = require('./analyzers/analyzer-factory');
const clipboardManager = require('./clipboard-manager');
const config = require('./config');
const logger = require('./logger');
const BatchSettings = require('./batch-settings');
const BatchPreviewer = require('./batch-previewer');

class BatchRenamer {
  constructor() {
    this.config = config.load();
    this.batchSettings = new BatchSettings();
    this.batchPreviewer = new BatchPreviewer();
    this.imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    this.processingResults = [];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isAiProcessedFile(fileName) {
    // Check if filename looks like AI-generated content
    // AI names typically have 3+ meaningful words separated by underscores
    // Exclude generic patterns like "image_timestamp", "screenshot_timestamp"
    
    const parts = fileName.toLowerCase().split('_');
    
    // If it's just "image" or "screenshot" + timestamp, it's NOT AI processed
    if (parts.length === 2 && 
        (parts[0] === 'image' || parts[0] === 'screenshot' || parts[0] === 'img') && 
        /^\d{13}$/.test(parts[1])) {
      return false; // This is a timestamp, not AI processed
    }
    
    // AI-processed files should have at least 3 parts or meaningful descriptive words
    if (parts.length >= 3) {
      // Check if it contains meaningful words (not just generic + timestamp)
      const meaningfulWords = parts.filter(part => 
        part.length >= 3 && 
        !/^\d+$/.test(part) && // Not just numbers
        !['image', 'screenshot', 'img', 'pic', 'photo'].includes(part) // Not generic terms
      );
      
      return meaningfulWords.length >= 2; // At least 2 meaningful descriptive words
    }
    
    // Single word or two words is likely not AI processed unless very descriptive
    return false;
  }

  isGenericFallback(analysis) {
    // Check if the analysis result is just a generic fallback (like "image_timestamp")
    if (!analysis || typeof analysis !== 'string') {
      return true;
    }
    
    const cleaned = analysis.toLowerCase().trim();
    
    // Check for patterns that indicate fallback generation
    if (/^(image|screenshot|img)_\d+$/.test(cleaned)) {
      return true; // This is a generic fallback
    }
    
    // Check if it's too short or generic
    if (cleaned.length < 5 || cleaned === 'image' || cleaned === 'screenshot') {
      return true;
    }
    
    return false;
  }

  getAnalyzer() {
    return AnalyzerFactory.createAnalyzer(this.config);
  }

  async previewOnly(folderPath, batchSettings) {
    console.log(`🔍 Generating preview for folder: ${folderPath}`);
    
    const preview = await this.batchPreviewer.generatePreview(folderPath, true);
    this.batchPreviewer.displayPreview(preview);
    
    return {
      preview: true,
      totalFiles: preview.totalFiles,
      processableFiles: preview.processableFiles,
      skippedFiles: preview.skippedFiles
    };
  }

  async processFolder(folderPath, options = {}) {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    if (!fs.statSync(folderPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${folderPath}`);
    }

    // Load batch settings
    const batchSettings = this.batchSettings.load();
    
    // Update folder in batch settings
    batchSettings.lastUsedFolder = folderPath;
    this.batchSettings.save(batchSettings);

    // Validate configuration before processing
    const validation = config.validate(this.config);
    if (!validation.valid) {
      throw new Error(`Configuration errors: ${validation.errors.join(', ')}`);
    }

    // Check if preview mode is requested
    if (options.preview || batchSettings.processMode === 'preview') {
      return await this.previewOnly(folderPath, batchSettings);
    }

    console.log(`🚀 Starting batch rename for folder: ${folderPath}`);
    console.log(`📝 Using format: ${batchSettings.filenameFormat}`);
    if (batchSettings.defaultPrefix) {
      console.log(`🏷️  Project prefix: ${batchSettings.defaultPrefix}`);
    }
    
    const files = await this.getImageFiles(folderPath, batchSettings.fileTypes);
    
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
        // AI-generated names should have meaningful words, not just "image_timestamp"
        if (batchSettings.skipProcessed && this.isAiProcessedFile(fileNameWithoutExt)) {
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
        
        let analysis;
        try {
          analysis = await analyzer.analyzeImage(filePath);
        } catch (analysisError) {
          console.log(`❌ Analysis failed for: ${fileName} - ${analysisError.message}`);
          logger.error('❌ Image analysis failed with error', { 
            file: filePath,
            provider: this.config.aiProvider,
            error: analysisError.message,
            timeTaken: `${(Date.now() - startTime) / 1000}s`
          });
          errors++;
          continue;
        }
        
        const timeTaken = Date.now() - startTime;
        
        // Check if analysis returned a meaningful result (not just a timestamp fallback)
        if (!analysis || this.isGenericFallback(analysis)) {
          console.log(`❌ Analysis failed or returned generic result for: ${fileName}`);
          logger.error('❌ Image analysis failed, no meaningful result', { 
            file: filePath,
            provider: this.config.aiProvider,
            result: analysis,
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

        const newFileName = this.batchSettings.generateFilename(analysis, ext, batchSettings);
        const finalFileName = await this.batchSettings.findUniqueFilename(newFileName, 
          batchSettings.processMode === 'copy' ? batchSettings.copyDestination : path.dirname(filePath));
        
        const newFilePath = batchSettings.processMode === 'copy' 
          ? path.join(batchSettings.copyDestination, finalFileName)
          : path.join(path.dirname(filePath), finalFileName);
        
        if (filePath !== newFilePath) {
          try {
            if (batchSettings.processMode === 'copy') {
              // Ensure destination directory exists
              const destDir = path.dirname(newFilePath);
              if (!fs.existsSync(destDir)) {
                await fs.promises.mkdir(destDir, { recursive: true });
              }
              await fs.promises.copyFile(filePath, newFilePath);
              console.log(`✅ Copied: ${fileName} → ${finalFileName} (${(timeTaken / 1000).toFixed(1)}s)`);
              logger.info(`File copied: ${fileName} → ${finalFileName}`);
            } else {
              await fs.promises.rename(filePath, newFilePath);
              console.log(`✅ Renamed: ${fileName} → ${finalFileName} (${(timeTaken / 1000).toFixed(1)}s)`);
              logger.info(`File renamed: ${fileName} → ${finalFileName}`);
            }
            processed++;
            
            // Copy to clipboard if enabled and not in copy mode
            if (batchSettings.copyToClipboard && batchSettings.processMode !== 'copy') {
              try {
                await clipboardManager.copyImageToClipboard(newFilePath);
                console.log(`📋 Copied to clipboard: ${finalFileName}`);
                logger.info('Image copied to clipboard');
              } catch (clipboardError) {
                console.log(`⚠️  Clipboard copy failed for ${finalFileName}: ${clipboardError.message}`);
                logger.warn('Clipboard copy failed', clipboardError);
              }
            }
            
            this.processingResults.push({
              originalName: fileName,
              newName: finalFileName,
              analysis: analysis,
              timeTaken: timeTaken,
              mode: batchSettings.processMode
            });
          } catch (operationError) {
            const operation = batchSettings.processMode === 'copy' ? 'copy' : 'rename';
            console.log(`❌ Failed to ${operation} ${fileName}: ${operationError.message}`);
            logger.error(`Error ${operation}ing file: ${filePath} to ${newFilePath}`, operationError);
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

  async getImageFiles(folderPath, fileTypes = null) {
    const files = await fs.promises.readdir(folderPath);
    const imageFiles = [];
    const allowedExtensions = fileTypes 
      ? fileTypes.map(type => `.${type}`) 
      : this.imageExtensions;
    
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stat = await fs.promises.stat(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (allowedExtensions.includes(ext)) {
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
    console.log('Usage:');
    console.log('  npm run batch-rename <folder-path>         # Process folder');
    console.log('  npm run batch-rename <folder-path> preview # Preview changes');
    console.log('  npm run batch-setup                        # Configure settings');
    console.log('');
    console.log('Examples:');
    console.log('  npm run batch-rename ~/Desktop/screenshots');
    console.log('  npm run batch-rename . preview');
    process.exit(1);
  }
  
  const folderPath = path.resolve(args[0]);
  const previewMode = args[1] === 'preview';
  const batchRenamer = new BatchRenamer();
  
  batchRenamer.processFolder(folderPath, { preview: previewMode })
    .then((result) => {
      if (result && result.preview) {
        console.log('\n🔍 Preview completed successfully!');
        console.log('Run without "preview" to execute the changes.');
      } else {
        console.log('\n🎉 Batch rename completed successfully!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Batch rename failed:', error.message);
      process.exit(1);
    });
}

module.exports = BatchRenamer;