const fs = require('fs');
const path = require('path');

const enPath = path.resolve(__dirname, '../messages/en.json');
const arPath = path.resolve(__dirname, '../messages/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getKeys(en);
const arKeys = getKeys(ar);

const enSet = new Set(enKeys);
const arSet = new Set(arKeys);

const missingInAr = enKeys.filter(k => !arSet.has(k));
const extraInAr = arKeys.filter(k => !enSet.has(k));

if (missingInAr.length === 0 && extraInAr.length === 0) {
  console.log("PASS: The key structures of en.json and ar.json match perfectly!");
  process.exit(0);
} else {
  if (missingInAr.length > 0) {
    console.error("FAIL: The following keys exist in en.json but are missing in ar.json:", missingInAr);
  }
  if (extraInAr.length > 0) {
    console.error("FAIL: The following keys exist in ar.json but are extra:", extraInAr);
  }
  process.exit(1);
}
