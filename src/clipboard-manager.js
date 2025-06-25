const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const logger = require('./logger');
const { executeAppleScript, executeCommand } = require('./utils/macos-helpers');

class ClipboardManager {
  constructor() {
    this.isMacOS = process.platform === 'darwin';
    
    // Define copy methods in priority order (chain of responsibility)
    this.copyMethods = [
      { name: 'Swift Helper', method: this.copyWithSwiftHelper.bind(this) },
      { name: 'AppleScript', method: this.copyWithAppleScript.bind(this) },
      { name: 'pbcopy', method: this.copyWithPbcopy.bind(this) }
    ];

    if (!this.isMacOS) {
      logger.warn('Clipboard functionality is only supported on macOS');
    }
  }

  async copyImageToClipboard(imagePath) {
    if (!this.isMacOS) {
      throw new Error('Clipboard operations only supported on macOS');
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const startTime = Date.now();
    logger.debug('Starting clipboard copy process', { imagePath });

    // Try each copy method in order until one succeeds
    for (const { name, method } of this.copyMethods) {
      try {
        logger.debug(`Attempting copy method: ${name}`, { method: name });
        
        const success = await method(imagePath);
        if (success) {
          const timeTaken = Date.now() - startTime;
          logger.info(`Image copied to clipboard successfully using ${name}`, {
            method: name,
            timeTaken: `${timeTaken}ms`,
            imagePath: path.basename(imagePath)
          });
          return true;
        }
        
        logger.debug(`Copy method ${name} returned false, trying next method`);
      } catch (error) {
        logger.warn(`Copy method ${name} failed, trying next method`, error, { method: name });
      }
    }

    // All methods failed
    const timeTaken = Date.now() - startTime;
    const error = new Error('All clipboard copy methods failed');
    logger.error('Failed to copy image to clipboard', error, { 
      timeTaken: `${timeTaken}ms`,
      methodsTried: this.copyMethods.length
    });
    throw error;
  }

  async copyWithSwiftHelper(imagePath) {
    try {
      const projectRoot = path.resolve(__dirname, '..');
      const helperPath = path.join(projectRoot, 'copy-helper');
      
      // Check if helper exists
      if (!fs.existsSync(helperPath)) {
        logger.warn('Swift copy-helper not found, falling back to other methods');
        return false;
      }

      // Execute the Swift helper
      executeCommand(`"${helperPath}" "${imagePath}"`, {
        timeout: 10000
      });

      logger.debug('Swift helper executed successfully');
      return true;

    } catch (error) {
      logger.debug('Swift helper failed', error);
      return false;
    }
  }

  async copyWithAppleScript(imagePath) {
    try {
      // Method 1: UI Automation - simulate Finder copy (preserves filename)
      const script = `
        tell application "Finder"
          reveal (POSIX file "${imagePath}" as alias)
          activate
        end tell
        
        delay 0.2
        
        tell application "System Events"
          keystroke "c" using command down
        end tell
        
        delay 0.1
      `;

      executeAppleScript(script, {
        timeout: 10000
      });

      logger.debug('Finder UI automation executed successfully');
      return true;

    } catch (error) {
      logger.debug('Finder UI automation failed', error);
      
      // Fallback: Copy image data (original method)
      try {
        const ext = path.extname(imagePath).toLowerCase();
        let imageType = 'PNGf';
        
        switch (ext) {
          case '.png':
            imageType = 'PNGf';
            break;
          case '.jpg':
          case '.jpeg':
            imageType = 'JPEG';
            break;
          case '.gif':
            imageType = 'GIFf';
            break;
          default:
            imageType = 'PNGf';
        }

        const fallbackScript = `
          tell application "System Events"
            set the clipboard to (read file POSIX file "${imagePath}" as «class ${imageType}»)
          end tell
        `;

        executeAppleScript(fallbackScript, {
          timeout: 10000
        });

        logger.debug('AppleScript fallback executed successfully');
        return true;

      } catch (fallbackError) {
        logger.debug('AppleScript fallback also failed', fallbackError);
        return false;
      }
    }
  }

  async copyWithPbcopy(imagePath) {
    try {
      const ext = path.extname(imagePath).toLowerCase();
      let mimeType = 'public.png';
      
      // Determine MIME type for pbcopy
      switch (ext) {
        case '.png':
          mimeType = 'public.png';
          break;
        case '.jpg':
        case '.jpeg':
          mimeType = 'public.jpeg';
          break;
        case '.gif':
          mimeType = 'public.gif';
          break;
        default:
          mimeType = 'public.png';
      }

      // Use pbcopy with specific image format
      executeCommand(`cat "${imagePath}" | pbcopy -Prefer ${mimeType}`, {
        timeout: 10000
      });

      logger.debug('pbcopy executed successfully');
      return true;

    } catch (error) {
      logger.debug('pbcopy method failed', error);
      return false;
    }
  }

  // Test if clipboard functionality is working
  async testClipboard() {
    if (!this.isMacOS) {
      return { success: false, error: 'macOS required' };
    }

    try {
      // Test by copying simple text
      execSync('echo "test" | pbcopy', { stdio: 'pipe' });
      const result = execSync('pbpaste', { encoding: 'utf8', stdio: 'pipe' });
      
      if (result.trim() === 'test') {
        return { success: true, message: 'Clipboard functionality working' };
      } else {
        return { success: false, error: 'Clipboard test failed' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Copy text to clipboard (utility function)
  async copyTextToClipboard(text) {
    if (!this.isMacOS) {
      throw new Error('Clipboard operations only supported on macOS');
    }

    try {
      execSync(`echo '${text}' | pbcopy`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      logger.error('Failed to copy text to clipboard', error);
      throw error;
    }
  }

  // Get current clipboard content as text (utility function)
  async getClipboardText() {
    if (!this.isMacOS) {
      throw new Error('Clipboard operations only supported on macOS');
    }

    try {
      const result = execSync('pbpaste', { encoding: 'utf8', stdio: 'pipe' });
      return result;
    } catch (error) {
      logger.error('Failed to get clipboard text', error);
      throw error;
    }
  }
}

module.exports = new ClipboardManager();