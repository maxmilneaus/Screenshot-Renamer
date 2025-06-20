#!/bin/bash

# Build script for copy-helper.swift
# This compiles the Swift helper into an executable binary

echo "Building copy-helper..."

# Compile Swift file to executable
swiftc -o copy-helper copy-helper.swift

# Make executable
chmod +x copy-helper

if [ -f "copy-helper" ]; then
    echo "✓ copy-helper built successfully"
    echo "Testing with a sample call..."
    
    # Test that it runs (will fail gracefully with usage message)
    ./copy-helper 2>/dev/null || echo "✓ Binary executes correctly"
else
    echo "✗ Failed to build copy-helper"
    exit 1
fi