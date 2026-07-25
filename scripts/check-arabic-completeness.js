const fs = require('fs');
const path = require('path');

// ANSI Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`${BLUE}====================================================${RESET}`);
console.log(`${BLUE}       ARABIC COMPLETENESS & HARDCODED TEXT SCANNER  ${RESET}`);
console.log(`${BLUE}====================================================${RESET}\n`);

// ==========================================================
// SECTION 1: Translation File Comparison
// ==========================================================
console.log(`${BLUE}--- SECTION 1: TRANSLATION FILE COMPARISON ---${RESET}`);

const enPath = path.resolve(__dirname, '../messages/en.json');
const arPath = path.resolve(__dirname, '../messages/ar.json');

function getLeafKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getLeafKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

let hasSection1Mismatch = false;
let enKeys = [];
let arKeys = [];

try {
  if (!fs.existsSync(enPath)) {
    throw new Error(`en.json not found at ${enPath}`);
  }
  if (!fs.existsSync(arPath)) {
    throw new Error(`ar.json not found at ${arPath}`);
  }

  const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const arJson = JSON.parse(fs.readFileSync(arPath, 'utf8'));

  enKeys = getLeafKeys(enJson);
  arKeys = getLeafKeys(arJson);

  console.log(`Total keys in en.json: ${enKeys.length}`);
  console.log(`Total keys in ar.json: ${arKeys.length}`);

  const enSet = new Set(enKeys);
  const arSet = new Set(arKeys);

  const missingInAr = enKeys.filter(k => !arSet.has(k));
  const extraInAr = arKeys.filter(k => !enSet.has(k));

  if (missingInAr.length > 0) {
    console.log(`${RED}Keys present in en.json but missing from ar.json:${RESET}`);
    missingInAr.forEach(k => console.log(`  - ${k}`));
    hasSection1Mismatch = true;
  }

  if (extraInAr.length > 0) {
    console.log(`${RED}Keys present in ar.json but missing from en.json:${RESET}`);
    extraInAr.forEach(k => console.log(`  - ${k}`));
    hasSection1Mismatch = true;
  }

  if (!hasSection1Mismatch) {
    console.log(`${GREEN}PASS: All translation keys match perfectly between en.json and ar.json!${RESET}`);
  } else {
    console.log(`${RED}FAIL: Key mismatch detected between translation files.${RESET}`);
  }
} catch (err) {
  console.error(`${RED}Error reading/parsing translation files:${RESET}`, err.message);
  hasSection1Mismatch = true;
}
console.log();

// ==========================================================
// SECTION 2: Hardcoded English Text Scan
// ==========================================================
console.log(`${BLUE}--- SECTION 2: HARDCODED ENGLISH TEXT SCAN ---${RESET}`);

// Recursively find all TSX files
function getTsxFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTsxFiles(fullPath));
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

// Scan a single TSX file for hardcoded strings
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileResults = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let cleanedLine = line;

    // Ignore import lines
    if (cleanedLine.trim().startsWith('import ') || cleanedLine.trim().startsWith('import{')) {
      return;
    }

    // Strip comments
    cleanedLine = cleanedLine.replace(/\/\/.*/g, '');
    cleanedLine = cleanedLine.replace(/\/\*.*?\*\//g, '');

    // Strip console logs
    cleanedLine = cleanedLine.replace(/\bconsole\.(log|error|warn|info|debug)\b.*/g, '');

    // Strip translation calls: t("...") or tAI("...")
    cleanedLine = cleanedLine.replace(/\b(t|tAI)\(\s*(['"`])(.*?)\2\s*\)/g, '');

    // Strip className="..." or className={'...'} or className={`...`}
    cleanedLine = cleanedLine.replace(/\bclassName=(['"`]).*?\1/g, '');
    cleanedLine = cleanedLine.replace(/\bclassName=\{\s*(['"`]).*?\1\s*\}/g, '');
    cleanedLine = cleanedLine.replace(/\bclassName=\{\s*`.*?`\s*\}/g, '');

    // Strip style attributes
    cleanedLine = cleanedLine.replace(/\bstyle=\{\{.*?\}\}/g, '');

    // Strip SVG paths (d="..." and viewBox="...")
    cleanedLine = cleanedLine.replace(/\bd=(['"`]).*?\1/g, '');
    cleanedLine = cleanedLine.replace(/\bviewBox=(['"`]).*?\1/g, '');

    // Strip rel and target attributes
    cleanedLine = cleanedLine.replace(/\brel=(['"`]).*?\1/g, '');
    cleanedLine = cleanedLine.replace(/\btarget=(['"`]).*?\1/g, '');

    // Ignore TypeScript type and interface declarations
    if (
      cleanedLine.includes('interface ') ||
      cleanedLine.includes('type ') ||
      cleanedLine.includes('export interface') ||
      cleanedLine.includes('export type')
    ) {
      return;
    }

    const candidates = [];

    // 1. Strings in double quotes, single quotes, or backticks
    const quoteRegex = /(["'`])(.*?)\1/g;
    let quoteMatch;
    while ((quoteMatch = quoteRegex.exec(cleanedLine)) !== null) {
      candidates.push(quoteMatch[2]);
    }

    // 2. JSX text: text between > and <
    const jsxTextRegex = />([^<{}]+)</g;
    let jsxMatch;
    while ((jsxMatch = jsxTextRegex.exec(cleanedLine)) !== null) {
      candidates.push(jsxMatch[1]);
    }

    const seenOnLine = new Set();

    candidates.forEach((str) => {
      const trimmed = str.trim();
      if (!trimmed) return;
      if (seenOnLine.has(trimmed)) return;
      seenOnLine.add(trimmed);

      // Must contain English letters
      if (!/[a-zA-Z]/.test(trimmed)) return;

      const words = trimmed.split(/\s+/);

      // Flag strings that are longer than 3 words OR contain spaces and look like a sentence or label
      const isSentenceOrLabel = words.length > 3 || (trimmed.includes(' ') && words.length >= 2);
      if (!isSentenceOrLabel) return;

      // Exclude single words
      if (words.length <= 1) return;

      // Exclude URLs and paths
      if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return;

      // Exclude strings containing class name dividers like - or :
      if (trimmed.includes('-') || trimmed.includes(':')) return;

      // Exclude if it looks like import path or file name extension
      if (/\.[a-zA-Z0-9]{2,4}$/.test(trimmed)) return;

      fileResults.push({
        lineNumber,
        text: trimmed
      });
    });
  });

  return fileResults;
}

const srcDir = path.resolve(__dirname, '../src');
let totalScannedFiles = 0;
let totalHardcodedStrings = 0;
const allHardcodedResults = {};

if (fs.existsSync(srcDir)) {
  const tsxFiles = getTsxFiles(srcDir);
  totalScannedFiles = tsxFiles.length;

  tsxFiles.forEach((filePath) => {
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const results = scanFile(filePath);
    if (results.length > 0) {
      allHardcodedResults[relativePath] = results;
      totalHardcodedStrings += results.length;
    }
  });

  if (totalHardcodedStrings > 0) {
    console.log(`${YELLOW}Potential hardcoded English strings found:${RESET}`);
    for (const relativePath in allHardcodedResults) {
      console.log(`\nFile: ${YELLOW}${relativePath}${RESET}`);
      allHardcodedResults[relativePath].forEach((match) => {
        console.log(`  Line ${match.lineNumber}: "${match.text}"`);
      });
    }
  } else {
    console.log(`${GREEN}PASS: No potential hardcoded English strings found!${RESET}`);
  }
} else {
  console.log(`${RED}Error: src/ directory not found at ${srcDir}${RESET}`);
}

console.log(`\nSummary: ${totalScannedFiles} files scanned, ${totalHardcodedStrings} potential hardcoded strings found.`);
console.log();

// ==========================================================
// SECTION 3: Summary
// ==========================================================
console.log(`${BLUE}--- SECTION 3: SUMMARY ---${RESET}`);

if (hasSection1Mismatch) {
  console.log(`${RED}STATUS: FAIL (Translation files have mismatches)${RESET}`);
} else if (totalHardcodedStrings > 0) {
  console.log(`${YELLOW}STATUS: WARN (Translation files match, but potential hardcoded strings found)${RESET}`);
} else {
  console.log(`${GREEN}STATUS: PASS (Translation files match and zero hardcoded strings found)${RESET}`);
}
