const { execSync } = require('child_process');

/**
 * Utility functions for macOS-specific operations
 */

/**
 * Execute AppleScript code with consistent error handling
 * @param {string} script - AppleScript code to execute
 * @param {Object} options - Options for execSync (timeout, stdio, etc.)
 * @returns {string} Command output
 * @throws {Error} If script execution fails
 */
function executeAppleScript(script, options = {}) {
  const defaultOptions = {
    stdio: 'pipe',
    timeout: 10000
  };
  
  const execOptions = { ...defaultOptions, ...options };
  
  try {
    return execSync(`osascript -e '${script}'`, execOptions);
  } catch (error) {
    throw new Error(`AppleScript execution failed: ${error.message}`);
  }
}

/**
 * Display a macOS notification
 * @param {string} message - Notification message
 * @param {string} title - Notification title (default: 'Screenshot Renamer')

/**
 * Execute a command that returns output (for notification commands that return strings)
 * @param {string} command - Shell command to execute
 * @param {Object} options - Options for execSync
 * @returns {string} Command output
 */
function executeCommand(command, options = {}) {
  const defaultOptions = {
    stdio: 'pipe',
    timeout: 10000
  };
  
  const execOptions = { ...defaultOptions, ...options };
  
  try {
    return execSync(command, execOptions);
  } catch (error) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

module.exports = {
  executeAppleScript,
  executeCommand
};