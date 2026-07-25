const fs = require('fs');
const path = require('path');

// Read the DEEPSEEK_API_KEY from environment or .env.local
let apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  // Try to load from .env.local manually
  try {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DEEPSEEK_API_KEY\s*=\s*(.*)/);
      if (match && match[1]) {
        apiKey = match[1].trim();
      }
    }
  } catch (err) {
    console.error('Error reading .env.local:', err);
  }
}

if (!apiKey) {
  console.error('CRITICAL: DEEPSEEK_API_KEY is not defined in the environment or .env.local');
  process.exit(1);
}

const enPath = path.join(__dirname, '../messages/en.json');
const arPath = path.join(__dirname, '../messages/ar.json');

if (!fs.existsSync(enPath)) {
  console.error(`Error: Source file ${enPath} does not exist.`);
  process.exit(1);
}

const enMessages = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const prompt = `You are a professional translator translating a Next.js application UI from English to Arabic.
Translate the following JSON object's values to Arabic.
Rules:
1. DO NOT translate the JSON keys.
2. Keep variables like {name} or {digit} exactly as they are in English inside the curly braces.
3. Keep the JSON structure identical.
4. Return ONLY the raw valid JSON object. Do not include markdown code block formatting (like \`\`\`json).

Here is the JSON object:
${JSON.stringify(enMessages, null, 2)}`;

async function translate() {
  console.log('Sending translation request to DeepSeek...');
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'You are a translation assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let resultText = data.choices[0].message.content.trim();
    
    // Clean up markdown block if deepseek wrapped it despite rules
    if (resultText.startsWith('```')) {
      resultText = resultText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    // Verify it is valid JSON
    const arMessages = JSON.parse(resultText);
    
    // Write out messages/ar.json
    fs.writeFileSync(arPath, JSON.stringify(arMessages, null, 2), 'utf8');
    console.log(`Success! Arabic translations written to ${arPath}`);
  } catch (err) {
    console.error('Translation failed:', err);
    process.exit(1);
  }
}

translate();
