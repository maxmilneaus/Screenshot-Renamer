const fs = require('fs');
const gemini = require('./src/gemini-vision');
const lmstudio = require('./src/lmstudio-vision');

console.log('=== SPEED COMPARISON TEST ===');

async function speedTest() {
  const testImage = '/Users/username/Desktop/sample-screenshot.png';
  
  if (!fs.existsSync(testImage)) {
    console.log('Test image not found');
    return;
  }

  console.log('Testing Gemini speed...');
  const geminiStart = Date.now();
  try {
    const geminiResult = await gemini.analyzeImage(testImage);
    const geminiTime = Date.now() - geminiStart;
    console.log(`Gemini: ${geminiTime}ms - ${geminiResult}`);
  } catch (err) {
    console.log(`Gemini failed: ${err.message}`);
  }

  console.log('\nTesting LM Studio speed...');
  const lmStart = Date.now();
  try {
    const lmResult = await lmstudio.analyzeImage(testImage);
    const lmTime = Date.now() - lmStart;
    console.log(`LM Studio: ${lmTime}ms - ${lmResult}`);
  } catch (err) {
    console.log(`LM Studio failed: ${err.message}`);
  }
}

speedTest();