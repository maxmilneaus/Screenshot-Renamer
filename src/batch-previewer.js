const fs = require('fs');
const path = require('path');
const BatchSettings = require('./batch-settings');

class BatchPreviewer {
  constructor() {
    this.batchSettings = new BatchSettings();
  }

  async generatePreview(folderPath, mockAnalysis = false) {
    const settings = this.batchSettings.load();
    const imageFiles = await this.getImageFiles(folderPath, settings.fileTypes);
    
    if (imageFiles.length === 0) {
      return {
        totalFiles: 0,
        processableFiles: 0,
        skippedFiles: 0,
        changes: [],
        errors: []
      };
    }

    const changes = [];
    const errors = [];
    let processableFiles = 0;
    let skippedFiles = 0;

    for (const filePath of imageFiles) {
      try {
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath);
        const fileNameWithoutExt = path.basename(filePath, ext);

        // Check if file should be skipped
        if (settings.skipProcessed && this.isAlreadyProcessed(fileNameWithoutExt)) {
          skippedFiles++;
          changes.push({
            originalPath: filePath,
            originalName: fileName,
            newName: fileName,
            newPath: filePath,
            status: 'skipped',
            reason: 'Already processed'
          });
          continue;
        }

        // Generate mock AI analysis or use provided analysis
        let analysis;
        if (mockAnalysis) {
          analysis = this.generateMockAnalysis(fileName);
        } else {
          // For preview mode, we can't actually analyze images without AI
          // So we'll use a placeholder
          analysis = `analyzed_${fileNameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        }

        // Generate new filename
        const newFileName = settings.generateFilename 
          ? settings.generateFilename(analysis, ext, settings)
          : this.batchSettings.generateFilename(analysis, ext, settings);

        // Determine destination path
        let newPath;
        if (settings.processMode === 'copy') {
          newPath = path.join(settings.copyDestination, newFileName);
        } else {
          newPath = path.join(path.dirname(filePath), newFileName);
        }

        // Check for filename conflicts
        const finalFileName = await this.batchSettings.findUniqueFilename(newFileName, path.dirname(newPath));
        const finalPath = path.join(path.dirname(newPath), finalFileName);

        processableFiles++;
        changes.push({
          originalPath: filePath,
          originalName: fileName,
          newName: finalFileName,
          newPath: finalPath,
          status: fileName === finalFileName ? 'no_change' : 'rename',
          analysis: analysis,
          size: await this.getFileSize(filePath)
        });

      } catch (error) {
        errors.push({
          file: path.basename(filePath),
          error: error.message
        });
      }
    }

    return {
      totalFiles: imageFiles.length,
      processableFiles,
      skippedFiles,
      changes,
      errors,
      settings: settings
    };
  }

  displayPreview(preview) {
    const { totalFiles, processableFiles, skippedFiles, changes, errors, settings } = preview;

    console.log('\n📊 Batch Preview Summary');
    console.log('═'.repeat(50));
    console.log(`📂 Folder: ${settings.lastUsedFolder}`);
    console.log(`🔄 Mode: ${settings.processMode}`);
    console.log(`📝 Format: ${settings.filenameFormat}`);
    if (settings.defaultPrefix) {
      console.log(`🏷️  Prefix: ${settings.defaultPrefix}`);
    }
    console.log(`📁 Total files: ${totalFiles}`);
    console.log(`✅ Will process: ${processableFiles}`);
    console.log(`⏭️  Will skip: ${skippedFiles}`);
    
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
    }

    if (changes.length > 0) {
      console.log('\n📋 Proposed Changes:');
      console.log('═'.repeat(80));
      
      // Display table header
      console.log('📄 Original Name'.padEnd(35) + ' → 📄 New Name'.padEnd(35) + ' Status');
      console.log('─'.repeat(80));

      // Display changes (limit to first 20 for readability)
      const displayChanges = changes.slice(0, 20);
      
      for (const change of displayChanges) {
        const originalName = this.truncateString(change.originalName, 32);
        const newName = this.truncateString(change.newName, 32);
        const statusIcon = this.getStatusIcon(change.status);
        
        console.log(
          originalName.padEnd(35) + 
          ' → ' + 
          newName.padEnd(35) + 
          statusIcon
        );
      }

      if (changes.length > 20) {
        console.log(`... and ${changes.length - 20} more files`);
      }
    }

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      console.log('═'.repeat(50));
      errors.forEach(error => {
        console.log(`   ${error.file}: ${error.error}`);
      });
    }

    // Show storage impact
    if (settings.processMode === 'copy') {
      const totalSize = changes.reduce((sum, change) => sum + (change.size || 0), 0);
      console.log(`\n💾 Storage impact: ${this.formatFileSize(totalSize)} will be copied`);
      console.log(`📂 Destination: ${settings.copyDestination}`);
    }
  }

  displayCompactPreview(preview, maxItems = 5) {
    const { totalFiles, processableFiles, skippedFiles, changes } = preview;

    console.log(`\n📊 Preview: ${processableFiles} to process, ${skippedFiles} to skip`);
    
    if (changes.length > 0) {
      console.log('\nSample changes:');
      changes.slice(0, maxItems).forEach((change, index) => {
        if (change.status !== 'skipped') {
          console.log(`   ${index + 1}. ${change.originalName} → ${change.newName}`);
        }
      });
      
      if (processableFiles > maxItems) {
        console.log(`   ... and ${processableFiles - maxItems} more files`);
      }
    }
  }

  generateMockAnalysis(fileName) {
    // Generate realistic mock analysis based on filename patterns
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('screenshot')) {
      return 'application_screenshot_interface';
    } else if (lowerName.includes('login')) {
      return 'user_login_form';
    } else if (lowerName.includes('dashboard')) {
      return 'admin_dashboard_view';
    } else if (lowerName.includes('profile')) {
      return 'user_profile_page';
    } else if (lowerName.includes('settings')) {
      return 'application_settings_menu';
    } else if (lowerName.includes('img_') || lowerName.includes('image')) {
      return 'generic_image_content';
    } else {
      // Generate from filename
      const baseName = path.basename(fileName, path.extname(fileName));
      return baseName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 30) || 'unknown_content';
    }
  }

  isAlreadyProcessed(fileName) {
    // Check if filename matches AI-generated pattern
    return fileName.match(/^[a-z_]+(_\d+)?$/);
  }

  async getImageFiles(folderPath, fileTypes) {
    const files = await fs.promises.readdir(folderPath);
    const imageFiles = [];
    
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stat = await fs.promises.stat(fullPath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase().substring(1);
        if (fileTypes.includes(ext)) {
          imageFiles.push(fullPath);
        }
      }
    }
    
    return imageFiles.sort();
  }

  async getFileSize(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  truncateString(str, maxLength) {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }

  getStatusIcon(status) {
    switch (status) {
      case 'rename':
        return '✅ Will rename';
      case 'no_change':
        return '➖ No change';
      case 'skipped':
        return '⏭️  Skipped';
      default:
        return '❓ Unknown';
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  exportPreview(preview, outputPath) {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        summary: {
          totalFiles: preview.totalFiles,
          processableFiles: preview.processableFiles,
          skippedFiles: preview.skippedFiles
        },
        settings: preview.settings,
        changes: preview.changes,
        errors: preview.errors
      };

      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to export preview:', error.message);
      return false;
    }
  }

  async validatePreview(preview) {
    const issues = [];

    // Check for duplicate new names
    const newNames = preview.changes
      .filter(change => change.status === 'rename')
      .map(change => change.newName);
    
    const duplicates = newNames.filter((name, index) => newNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      issues.push(`Duplicate new filenames detected: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Check destination directory for copy mode
    if (preview.settings.processMode === 'copy') {
      if (!fs.existsSync(preview.settings.copyDestination)) {
        issues.push('Copy destination directory does not exist');
      }
    }

    // Check for potential overwrites
    for (const change of preview.changes) {
      if (change.status === 'rename' && fs.existsSync(change.newPath)) {
        issues.push(`File would overwrite existing: ${change.newName}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }
}

module.exports = BatchPreviewer;