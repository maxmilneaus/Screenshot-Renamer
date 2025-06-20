#!/usr/bin/env swift

import Foundation
import AppKit

// Simple command-line utility to copy image files to clipboard with filename metadata
// Usage: ./copy-helper /path/to/image.png

guard CommandLine.arguments.count == 2 else {
    print("Usage: copy-helper <image-path>")
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let fileURL = URL(fileURLWithPath: imagePath)

// Verify file exists
guard FileManager.default.fileExists(atPath: imagePath) else {
    print("Error: File does not exist at path: \(imagePath)")
    exit(1)
}

// Get the pasteboard
let pasteboard = NSPasteboard.general
pasteboard.clearContents()

// Read image data
guard let imageData = NSData(contentsOfFile: imagePath) else {
    print("Error: Could not read image data from file")
    exit(1)
}

// Create NSImage from data
guard let image = NSImage(data: imageData as Data) else {
    print("Error: Could not create image from data")
    exit(1)
}

// Write both file URL and image data to pasteboard
// This mimics what Finder does - includes both the file reference and the image content
let success = pasteboard.writeObjects([
    fileURL as NSURL,  // This preserves the filename
    image             // This provides the image data
])

if success {
    print("Successfully copied image with filename metadata to clipboard")
    exit(0)
} else {
    print("Error: Failed to copy to clipboard")
    exit(1)
}