# Changelog

All notable changes to Screenshot Renamer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Performance testing utilities
- Configurable LM Studio parameters for speed optimization
- Enhanced timing display (seconds instead of milliseconds)
- File conflict handling in rename operations

### Changed
- Improved error handling for file operations
- Better async/await patterns in file generation

### Fixed
- File renaming race conditions
- Performance timing accuracy

## [1.0.0] - 2025-06-25

### Added
- Initial public release
- AI-powered screenshot renaming with multiple providers:
  - Google Gemini (cloud)
  - LM Studio (local)
  - Ollama (local)
- Automatic clipboard copying
- macOS LaunchAgent integration
- Interactive setup wizard
- Comprehensive configuration management
- Keychain integration for secure API key storage
- File watching with intelligent filtering
- Performance comparison between AI providers
- Robust error handling and logging
- Multiple installation and configuration methods

### Features
- Watches macOS screenshot folder automatically
- Generates descriptive filenames using AI vision models
- Copies renamed images to clipboard
- Runs as background service
- Configurable retry logic and timeouts
- Supports multiple image formats (PNG, JPG, GIF, WebP)
- Smart filename conflict resolution
- Performance monitoring and timing

### Documentation
- Comprehensive README with setup instructions
- Distribution guide for developers
- Contributing guidelines
- MIT license

### Platform Support
- macOS only (leverages platform-specific features)
- Node.js 16.0.0+ required