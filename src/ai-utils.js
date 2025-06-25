// Shared utilities for AI vision analyzers
const path = require('path');

/**
 * Get MIME type for image file
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Clean filename from AI analysis result
 */
function cleanFilename(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Remove multiple underscores
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 50) // Limit length
    || 'analyzed_image'; // Fallback if cleaning results in empty string
}

/**
 * Generate fallback filename when AI analysis fails
 */
function getFallbackName(imagePath) {
  const basename = path.basename(imagePath, path.extname(imagePath));
  
  // If it looks like a screenshot, use that pattern
  if (basename.toLowerCase().includes('screenshot')) {
    return `screenshot_${Date.now()}`;
  }
  
  // Generic fallback
  return `image_${Date.now()}`;
}

module.exports = {
  getMimeType,
  cleanFilename,
  getFallbackName
};