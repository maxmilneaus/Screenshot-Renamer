const https = require('https');
const crypto = require('crypto');

class NetworkSecurity {
  constructor() {
    this.requestTimeouts = {
      gemini: 30000,    // 30 seconds for Gemini API
      lmstudio: 60000   // 60 seconds for local LM Studio (vision models can be slow)
    };
    
    this.retryLimits = {
      gemini: 3,
      lmstudio: 2
    };
    
    this.rateLimits = new Map(); // Track rate limiting per endpoint
  }

  /**
   * Create secure HTTP agent with proper SSL validation
   */
  createSecureAgent() {
    return new https.Agent({
      // Keep connections alive but limit them
      keepAlive: true,
      maxSockets: 5,
      maxFreeSockets: 2,
      timeout: 60000,
      
      // Enforce strong SSL/TLS
      secureProtocol: 'TLSv1_2_method',
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384'
      ].join(':'),
      
      // Certificate validation
      rejectUnauthorized: true,
      checkServerIdentity: (hostname, cert) => {
        // Additional hostname verification if needed
        return undefined; // Let default validation handle it
      }
    });
  }

  /**
   * Validate SSL certificate
   */
  validateCertificate(cert, hostname) {
    if (!cert) {
      return { valid: false, reason: 'No certificate provided' };
    }

    // Check expiration
    const now = new Date();
    const notAfter = new Date(cert.valid_to);
    const notBefore = new Date(cert.valid_from);
    
    if (now > notAfter) {
      return { valid: false, reason: 'Certificate expired' };
    }
    
    if (now < notBefore) {
      return { valid: false, reason: 'Certificate not yet valid' };
    }

    // Check hostname
    if (cert.subject && cert.subject.CN !== hostname && 
        (!cert.subjectaltname || !cert.subjectaltname.includes(hostname))) {
      return { valid: false, reason: 'Certificate hostname mismatch' };
    }

    return { valid: true };
  }

  /**
   * Rate limiting for API calls
   */
  checkRateLimit(endpoint, maxRequests = 60, windowMs = 60000) {
    const now = Date.now();
    
    if (!this.rateLimits.has(endpoint)) {
      this.rateLimits.set(endpoint, []);
    }
    
    const requests = this.rateLimits.get(endpoint);
    
    // Clean old requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded',
        resetTime: Math.min(...validRequests) + windowMs
      };
    }
    
    validRequests.push(now);
    this.rateLimits.set(endpoint, validRequests);
    
    return { allowed: true };
  }

  /**
   * Secure request wrapper with retries and validation
   */
  async secureRequest(url, options = {}, provider = 'gemini') {
    const maxRetries = this.retryLimits[provider] || 3;
    const timeout = this.requestTimeouts[provider] || 30000;
    
    // Rate limiting check
    const rateCheck = this.checkRateLimit(provider);
    if (!rateCheck.allowed) {
      throw new Error(`Rate limit exceeded for ${provider}. Reset at ${new Date(rateCheck.resetTime)}`);
    }

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add security headers and timeout
        const secureOptions = {
          ...options,
          timeout: timeout,
          agent: this.createSecureAgent(),
          headers: {
            'User-Agent': 'Screenshot-Renamer/1.0.0',
            'Accept': 'application/json',
            'Connection': 'close', // Prevent connection reuse for security
            ...options.headers
          }
        };

        // For non-local requests, add additional security
        if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
          secureOptions.headers['X-Request-ID'] = crypto.randomUUID();
        }

        const response = await this.makeRequest(url, secureOptions);
        
        // Validate response
        if (!response.ok && response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Exponential backoff for retries
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Make HTTP request with timeout
   */
  async makeRequest(url, options) {
    const { timeout = 30000, ...requestOptions } = options;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      // Use appropriate library (fetch, axios, etc.)
      // This is a placeholder - integrate with your HTTP library
      const request = require('node-fetch')(url, requestOptions);
      
      request
        .then(response => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Validate API endpoint URL
   */
  validateEndpoint(url, allowedHosts = []) {
    try {
      const parsed = new URL(url);
      
      // Only allow HTTPS for external services
      if (!url.includes('localhost') && !url.includes('127.0.0.1') && parsed.protocol !== 'https:') {
        return { valid: false, reason: 'Only HTTPS allowed for external services' };
      }
      
      // Check against allowed hosts if provided
      if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname)) {
        return { valid: false, reason: 'Host not in allowed list' };
      }
      
      // Prevent private network access from external URLs
      if (!this.isLocalhost(parsed.hostname) && this.isPrivateNetwork(parsed.hostname)) {
        return { valid: false, reason: 'Access to private networks not allowed' };
      }
      
      return { valid: true, parsed };
      
    } catch (error) {
      return { valid: false, reason: `Invalid URL: ${error.message}` };
    }
  }

  /**
   * Check if hostname is localhost
   */
  isLocalhost(hostname) {
    return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname);
  }

  /**
   * Check if hostname is in private network range
   */
  isPrivateNetwork(hostname) {
    // Basic check for private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./ // Link-local
    ];
    
    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Sleep utility for retries
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up rate limit data periodically
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [endpoint, requests] of this.rateLimits.entries()) {
      const validRequests = requests.filter(time => now - time < maxAge);
      if (validRequests.length === 0) {
        this.rateLimits.delete(endpoint);
      } else {
        this.rateLimits.set(endpoint, validRequests);
      }
    }
  }
}

module.exports = new NetworkSecurity();