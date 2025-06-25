const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityUtils {
  constructor() {
    // Forbidden characters for filenames across platforms
    this.forbiddenChars = /[<>:"/\\|?*\x00-\x1f]/g;
    this.forbiddenNames = new Set([
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ]);
    
    // Valid image MIME types
    this.validImageTypes = new Set([
      'image/png',
      'image/jpeg', 
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff'
    ]);
    
    // Valid image extensions
    this.validImageExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'
    ]);
    
    this.maxFilenameLength = 200; // Conservative limit for cross-platform compatibility
    this.maxProcessingRate = 10; // Max files per minute
    this.processingHistory = [];
  }

  /**
   * Sanitize AI-generated filename to be filesystem-safe
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file';
    }

    let sanitized = filename
      // Remove forbidden characters
      .replace(this.forbiddenChars, '_')
      // Normalize Unicode
      .normalize('NFC')
      // Replace multiple underscores/spaces with single underscore
      .replace(/[_\s]+/g, '_')
      // Remove leading/trailing dots and underscores
      .replace(/^[._]+|[._]+$/g, '')
      // Convert to lowercase for consistency
      .toLowerCase()
      // Limit length
      .substring(0, this.maxFilenameLength);

    // Check for forbidden Windows names
    const nameOnly = sanitized.split('.')[0].toUpperCase();
    if (this.forbiddenNames.has(nameOnly)) {
      sanitized = `file_${sanitized}`;
    }

    // Ensure we have something
    if (!sanitized || sanitized.length < 1) {
      sanitized = 'unnamed_file';
    }

    return sanitized;
  }

  /**
   * Validate file is a legitimate image
   */
  async validateImageFile(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      
      // Check file size (prevent massive files)
      if (stats.size > 50 * 1024 * 1024) { // 50MB limit
        return { valid: false, reason: 'File too large (>50MB)' };
      }

      if (stats.size < 100) { // Minimum viable image size
        return { valid: false, reason: 'File too small (<100 bytes)' };
      }

      // Check extension
      const ext = path.extname(filePath).toLowerCase();
      if (!this.validImageExtensions.has(ext)) {
        return { valid: false, reason: 'Invalid file extension' };
      }

      // Read file header to validate it's actually an image
      const buffer = await fs.promises.readFile(filePath, { start: 0, end: 12 });
      const isValidImage = this.validateImageHeader(buffer, ext);
      
      if (!isValidImage) {
        return { valid: false, reason: 'Invalid image file format' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: `File validation error: ${error.message}` };
    }
  }

  /**
   * Validate image file header matches extension
   */
  validateImageHeader(buffer, extension) {
    const headers = {
      '.png': [0x89, 0x50, 0x4E, 0x47],
      '.jpg': [0xFF, 0xD8, 0xFF],
      '.jpeg': [0xFF, 0xD8, 0xFF],
      '.gif': [0x47, 0x49, 0x46],
      '.webp': [0x52, 0x49, 0x46, 0x46], // RIFF
      '.bmp': [0x42, 0x4D]
    };

    const expectedHeader = headers[extension];
    if (!expectedHeader) return false;

    for (let i = 0; i < expectedHeader.length; i++) {
      if (buffer[i] !== expectedHeader[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate file path for security
   */
  validateFilePath(filePath, allowedDirectory) {
    try {
      const resolved = path.resolve(filePath);
      const allowedResolved = path.resolve(allowedDirectory);
      
      // Prevent directory traversal
      if (!resolved.startsWith(allowedResolved)) {
        return { valid: false, reason: 'Path outside allowed directory' };
      }

      // Check for suspicious patterns
      if (resolved.includes('..') || resolved.includes('//')) {
        return { valid: false, reason: 'Suspicious path pattern detected' };
      }

      return { valid: true, path: resolved };
    } catch (error) {
      return { valid: false, reason: `Path validation error: ${error.message}` };
    }
  }

  /**
   * Rate limiting for file processing
   */
  checkProcessingRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    this.processingHistory = this.processingHistory.filter(time => time > oneMinuteAgo);
    
    if (this.processingHistory.length >= this.maxProcessingRate) {
      return { allowed: false, reason: 'Processing rate limit exceeded' };
    }

    this.processingHistory.push(now);
    return { allowed: true };
  }

  /**
   * Generate secure random filename suffix
   */
  generateSecureSuffix(length = 8) {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }

  /**
   * Check available disk space
   */
  async checkDiskSpace(directory, requiredBytes = 10 * 1024 * 1024) { // 10MB default
    try {
      const stats = await fs.promises.statfs(directory);
      const available = stats.bavail * stats.bsize;
      
      return {
        sufficient: available > requiredBytes,
        available: available,
        required: requiredBytes
      };
    } catch (error) {
      // Fallback: assume we have space if we can't check
      return { sufficient: true, available: null, required: requiredBytes };
    }
  }

  /**
   * Secure file permissions
   */
  async setSecurePermissions(filePath) {
    try {
      // Set to user read/write only (600)
      await fs.promises.chmod(filePath, 0o600);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate environment and process security
   */
  validateEnvironment() {
    const issues = [];

    // Check if running as root (bad practice)
    if (process.getuid && process.getuid() === 0) {
      issues.push('Running as root user - security risk');
    }

    // Check Node.js version for known vulnerabilities
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion < 16) {
      issues.push('Node.js version may have security vulnerabilities');
    }

    // Check for development environment in production
    if (process.env.NODE_ENV === 'development' && process.env.PROD) {
      issues.push('Development environment detected in production');
    }

    return {
      secure: issues.length === 0,
      issues: issues
    };
  }
}

module.exports = new SecurityUtils();