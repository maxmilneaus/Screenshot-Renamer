#!/usr/bin/env node

const LMStudioVisionAnalyzer = require('./src/lmstudio-vision.js');
const config = require('./src/config');
const path = require('path');
const fs = require('fs');

async function testPerformance() {
  console.log('🚀 Testing LM Studio Performance...\n');

  // Load config
  const currentConfig = config.load();
  console.log('Configuration:');
  console.log(`  Provider: ${currentConfig.aiProvider}`);
  console.log(`  Base URL: ${currentConfig.lmstudioBaseUrl}`);
  console.log(`  Model: ${currentConfig.lmstudioModel}`);
  console.log(`  Max Tokens: ${currentConfig.lmstudioMaxTokens || 50}`);
  console.log(`  Temperature: ${currentConfig.lmstudioTemperature || 0.1}\n`);

  // Create analyzer
  const analyzer = new LMStudioVisionAnalyzer(currentConfig);

  // Test 1: API Connection
  console.log('1️⃣ Testing API connection...');
  const connectionTest = await analyzer.testConnection();
  if (!connectionTest.success) {
    console.error('❌ Connection failed:', connectionTest.error);
    console.log('\n💡 Make sure:');
    console.log('   - LM Studio is running');
    console.log('   - A vision model is loaded');
    console.log('   - Server is started on port 1234');
    return;
  }
  console.log('✅ Connection successful\n');

  // Test 2: Find a test image
  console.log('2️⃣ Looking for test images...');
  const watchFolder = currentConfig.watchFolder;
  const testImages = [];
  
  if (fs.existsSync(watchFolder)) {
    const files = fs.readdirSync(watchFolder);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (imageExtensions.includes(ext)) {
        const fullPath = path.join(watchFolder, file);
        testImages.push(fullPath);
        if (testImages.length >= 3) break; // Only test with first 3 images
      }
    }
  }

  if (testImages.length === 0) {
    console.log('❌ No test images found in watch folder:', watchFolder);
    console.log('💡 Add some images to test with, or take a screenshot');
    return;
  }

  console.log(`✅ Found ${testImages.length} test image(s)\n`);

  // Test 3: Performance Test
  console.log('3️⃣ Running performance tests...\n');
  
  for (let i = 0; i < testImages.length; i++) {
    const imagePath = testImages[i];
    const imageName = path.basename(imagePath);
    
    console.log(`🖼️  Testing with: ${imageName}`);
    
    const startTime = Date.now();
    
    try {
      const result = await analyzer.analyzeImage(imagePath);
      const endTime = Date.now();
      const timeTaken = endTime - startTime;
      
      console.log(`   ✅ Result: "${result}"`);
      console.log(`   ⏱️  Time: ${(timeTaken / 1000).toFixed(1)} seconds`);
      
      // Performance evaluation
      if (timeTaken < 5000) {
        console.log('   🚀 Excellent performance!');
      } else if (timeTaken < 15000) {
        console.log('   👍 Good performance');
      } else if (timeTaken < 30000) {
        console.log('   ⚠️  Slow - consider optimizing GPU layers');
      } else {
        console.log('   🐌 Very slow - check GPU offloading');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('✅ Performance test complete!');
  console.log('\n💡 Tips for better performance:');
  console.log('   - Maximize GPU layers in LM Studio');
  console.log('   - Use quantized models (Q4, Q5)');
  console.log('   - Ensure sufficient VRAM available');
}

// Run the test
testPerformance().catch(console.error);