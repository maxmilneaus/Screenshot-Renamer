const pino = require('pino');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecureLogger {
  constructor() {
    this.sensitivePatterns = [
      /AIza[A-Za-z0-9_-]{35}/g,          // Gemini API keys
      /sk-[A-Za-z0-9]{48}/g,             // OpenAI API keys
      /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, // Bearer tokens
      /password["\s]*[:=]["\s]*[^"\s,}]+/gi,  // Passwords
      /api[_-]?key["\s]*[:=]["\s]*[^"\s,}]+/gi, // API keys
      /token["\s]*[:=]["\s]*[^"\s,}]+/gi,      // Tokens
    ];

    this.logRotation = {
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      compress: true
    };

    this.setupLogger();
  }

  setupLogger() {
    const logDir = path.join(process.env.HOME || process.env.USERPROFILE, '.screenshot-renamer-logs');
    
    // Ensure log directory exists with secure permissions
    this.ensureSecureLogDir(logDir);

    // Use standard console for now to avoid pino transport issues
    const transport = null;

    // Simplified logger for debugging
    this.logger = {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
  }

  ensureSecureLogDir(logDir) {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { mode: 0o750, recursive: true });
      }
      
      // Set secure permissions on log directory
      fs.chmodSync(logDir, 0o750);
    } catch (error) {
      console.warn('Failed to create secure log directory:', error.message);
    }
  }

  sanitizeLogData(data) {
    if (typeof data === 'string') {
      return this.redactSensitiveData(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = Array.isArray(data) ? [] : {};
      
      for (const key in data) {
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof data[key] === 'string') {
          sanitized[key] = this.redactSensitiveData(data[key]);
        } else if (typeof data[key] === 'object') {
          sanitized[key] = this.sanitizeLogData(data[key]);
        } else {
          sanitized[key] = data[key];
        }
      }
      
      return sanitized;
    }
    
    return data;
  }

  redactSensitiveData(text) {
    let sanitized = text;
    
    this.sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    return sanitized;
  }

  isSensitiveKey(key) {
    const sensitiveKeys = [
      'password', 'apikey', 'api_key', 'token', 'secret', 'private',
      'auth', 'authorization', 'credential', 'key', 'pass'
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  sanitizeUrl(url) {
    if (!url) return url;
    
    try {
      const parsed = new URL(url);
      // Remove query parameters that might contain sensitive data
      parsed.search = '';
      return parsed.toString();
    } catch {
      return '[INVALID_URL]';
    }
  }

  sanitizeHeaders(headers) {
    if (!headers) return headers;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  // Secure logging methods
  info(message, data = {}) {
    this.logger.info(this.sanitizeLogData(data), this.redactSensitiveData(message));
  }

  warn(message, data = {}) {
    this.logger.warn(this.sanitizeLogData(data), this.redactSensitiveData(message));
  }

  error(message, error = null, data = {}) {
    const logData = { ...this.sanitizeLogData(data) };
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    this.logger.error(logData, this.redactSensitiveData(message));
  }

  debug(message, data = {}) {
    this.logger.debug(this.sanitizeLogData(data), this.redactSensitiveData(message));
  }

  // Security event logging
  securityEvent(event, details = {}) {
    this.logger.warn({
      type: 'SECURITY_EVENT',
      event: event,
      timestamp: new Date().toISOString(),
      details: this.sanitizeLogData(details),
      process: {
        pid: process.pid,
        uid: process.getuid ? process.getuid() : null,
        gid: process.getgid ? process.getgid() : null
      }
    }, `Security event: ${event}`);
  }

  // API usage logging
  apiEvent(provider, action, success, details = {}) {
    this.logger.info({
      type: 'API_EVENT',
      provider: provider,
      action: action,
      success: success,
      timestamp: new Date().toISOString(),
      details: this.sanitizeLogData(details)
    }, `API ${provider}: ${action} ${success ? 'succeeded' : 'failed'}`);
  }

  // Service lifecycle logging
  serviceEvent(event, details = {}) {
    this.logger.info({
      type: 'SERVICE_EVENT',
      event: event,
      timestamp: new Date().toISOString(),
      details: this.sanitizeLogData(details)
    }, `Service: ${event}`);
  }

  // Log rotation management
  async rotateLogsIfNeeded() {
    try {
      const logDir = path.join(process.env.HOME || process.env.USERPROFILE, '.screenshot-renamer-logs');
      const logFile = path.join(logDir, 'app.log');
      
      if (fs.existsSync(logFile)) {
        const stats = await fs.promises.stat(logFile);
        
        if (stats.size > this.logRotation.maxSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedFile = path.join(logDir, `app.log.${timestamp}`);
          
          await fs.promises.rename(logFile, rotatedFile);
          
          // Compress if needed (placeholder for compression logic)
          if (this.logRotation.compress) {
            // Implementation would go here
          }
          
          // Clean up old log files
          await this.cleanupOldLogs(logDir);
        }
      }
    } catch (error) {
      this.logger.warn('Log rotation failed', { error: error.message });
    }
  }

  async cleanupOldLogs(logDir) {
    try {
      const files = await fs.promises.readdir(logDir);
      const logFiles = files
        .filter(file => file.startsWith('app.log.'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          time: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only the most recent files
      const filesToDelete = logFiles.slice(this.logRotation.maxFiles);
      
      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path);
      }
    } catch (error) {
      this.logger.warn('Log cleanup failed', { error: error.message });
    }
  }
}

module.exports = new SecureLogger();