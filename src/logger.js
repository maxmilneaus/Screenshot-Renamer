const pino = require('pino');
const os = require('os');
const path = require('path');

class Logger {
  constructor() {
    this.logger = null;
    this.initialize();
  }

  initialize() {
    // Get log level from config or environment
    const logLevel = this.getLogLevel();
    
    // Determine if we're running as a background service
    const isBackgroundService = process.env.NODE_ENV === 'production' || process.argv.includes('--service');
    
    const options = {
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    // Configure output based on environment
    if (isBackgroundService) {
      // Background service: write to log files
      const logDir = path.join(os.homedir(), 'Library', 'Logs');
      options.transport = {
        targets: [
          {
            target: 'pino/file',
            options: {
              destination: path.join(logDir, 'screenshot-renamer.log'),
              mkdir: true
            }
          },
          // Also log errors to separate file
          {
            target: 'pino/file',
            level: 'error',
            options: {
              destination: path.join(logDir, 'screenshot-renamer-error.log'),
              mkdir: true
            }
          }
        ]
      };
    } else {
      // Development/interactive: pretty print to console
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      };
    }

    this.logger = pino(options);
    // Only show initialization message for background services or debug mode
    if (isBackgroundService || logLevel === 'debug') {
      this.info('Logger initialized', { level: logLevel, background: isBackgroundService });
    }
  }

  getLogLevel() {
    // Try multiple sources for log level
    if (process.env.LOG_LEVEL) {
      return process.env.LOG_LEVEL.toLowerCase();
    }

    try {
      const config = require('./config');
      return config.get('logLevel') || 'info';
    } catch (error) {
      // Fallback if config not available yet
      return 'info';
    }
  }

  // Convenience methods
  debug(message, meta = {}) {
    this.logger.debug(meta, message);
  }

  info(message, meta = {}) {
    this.logger.info(meta, message);
  }

  warn(message, meta = {}) {
    this.logger.warn(meta, message);
  }

  error(message, error, meta = {}) {
    if (error instanceof Error) {
      this.logger.error({ ...meta, error: error.message, stack: error.stack }, message);
    } else {
      this.logger.error({ ...meta, error }, message);
    }
  }

  formatTime(ms) {
    return `${(ms / 1000).toFixed(1)} seconds`;
  }

  // Special methods for key events
  fileProcessed(originalName, newName, timeTaken) {
    this.info('File processed successfully', {
      originalName,
      newName,
      timeTaken: this.formatTime(timeTaken),
      event: 'file_processed'
    });
  }

  aiAnalysis(filename, analysis, timeTaken) {
    this.info('AI analysis completed', {
      filename,
      analysis,
      timeTaken: this.formatTime(timeTaken),
      event: 'ai_analysis'
    });
  }

  serviceEvent(event, details = {}) {
    this.info(`Service ${event}`, {
      ...details,
      event: `service_${event}`
    });
  }

  apiError(operation, error, retryable = false) {
    this.error(`API error during ${operation}`, error, {
      operation,
      retryable,
      event: 'api_error'
    });
  }
}

// Export singleton instance
module.exports = new Logger();