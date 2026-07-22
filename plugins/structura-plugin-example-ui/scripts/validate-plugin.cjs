#!/usr/bin/env node
/**
 * Plugin Validation Script
 *
 * Checks for common issues that cause "React is not defined" errors
 * in React-based Structura plugins.
 *
 * Usage: node scripts/validate-plugin.js
 */

const fs = require('fs');
const path = require('path');

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Issues found
const issues = [];
const warnings = [];

/**
 * Check if a file uses JSX without proper React scope
 * Only flags JSX that appears at module level (outside functions)
 */
function checkJsxScope(filePath, content) {
  // Skip non-React files
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;

  // Skip if no JSX in file
  if (!/<[a-zA-Z][^>]*>/.test(content)) return;

  // Split content into lines and find what level JSX appears at
  const lines = content.split('\n');
  let braceDepth = 0;
  let parenDepth = 0;
  let inString = false;
  let inComment = false;
  let inMultilineComment = false;
  let inTemplateLiteral = false;
  let foundGetReact = false;
  let jsxBeforeGetReact = false;
  let jsxAtModuleLevel = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track multi-line comments
    if (inMultilineComment) {
      if (line.includes('*/')) {
        inMultilineComment = false;
      }
      continue;
    }

    // Skip comments
    if (line.trim().startsWith('//')) continue;
    if (line.includes('/*')) {
      inMultilineComment = true;
      continue;
    }

    // Track string state
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j - 1] : '';

      // Template literals
      if (char === '`' && prevChar !== '\\') {
        inTemplateLiteral = !inTemplateLiteral;
        continue;
      }
      if (inTemplateLiteral) continue;

      // Regular strings
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      // Track braces for function scope
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
    }

    // Check for getReact()
    if (line.includes('getReact()')) {
      foundGetReact = true;
    }

    // Check for JSX tags
    const hasJsx = /<[a-zA-Z][^>]*>/.test(line);

    if (hasJsx) {
      // JSX at module level (depth 0, not inside parens for generics)
      if (braceDepth === 0 && parenDepth === 0) {
        jsxAtModuleLevel = true;
        if (!foundGetReact) {
          jsxBeforeGetReact = true;
        }
      }
    }
  }

  if (jsxBeforeGetReact) {
    issues.push({
      file: filePath,
      line: 1,
      message: 'JSX appears at module level before getReact(). Define components inside a factory function.',
      fix: 'Use: export function createComponent() { const React = getReact(); ... }'
    });
  } else if (jsxAtModuleLevel && !foundGetReact) {
    issues.push({
      file: filePath,
      line: 1,
      message: 'File uses JSX but does not call getReact(). Add "const React = getReact();" before using JSX.',
      fix: 'const React = getReact();'
    });
  }
}

/**
 * Check for hook usage without React prefix
 */
function checkHooks(filePath, content) {
  // Skip if file doesn't have getReact
  if (!content.includes('getReact()')) return;

  // Patterns for hooks without React prefix
  const hookPatterns = [
    { regex: /(?<!React\.)useState\s*\(/, name: 'useState' },
    { regex: /(?<!React\.)useEffect\s*\(/, name: 'useEffect' },
    { regex: /(?<!React\.)useCallback\s*\(/, name: 'useCallback' },
    { regex: /(?<!React\.)useMemo\s*\(/, name: 'useMemo' },
    { regex: /(?<!React\.)useRef\s*\(/, name: 'useRef' },
    { regex: /(?<!React\.)useContext\s*\(/, name: 'useContext' },
  ];

  hookPatterns.forEach(({ regex, name }) => {
    if (regex.test(content)) {
      issues.push({
        file: filePath,
        line: content.split('\n').findIndex(line => regex.test(line)) + 1,
        message: `Found ${name}() without React prefix. Use React.${name}() instead.`,
        fix: `Replace ${name}(...) with React.${name}(...)`
      });
    }
  });
}

/**
 * Check for component naming convention
 * Only checks .tsx files and skips utility functions
 */
function checkComponentNames(filePath, content) {
  // Only check .tsx files (components)
  if (!filePath.endsWith('.tsx')) return;

  // Skip hooks files - those contain utility functions, not components
  if (filePath.includes('/hooks/')) return;

  // Skip files with 'export function' that look like factory functions
  const lines = content.split('\n');

  // Pattern: exported functions that start with lowercase and look like components
  // Only flag if the function returns JSX
  const functionPattern = /^export\s+function\s+([a-z][a-zA-Z]*)\s*\(/gm;
  let match;

  while ((match = functionPattern.exec(content)) !== null) {
    const name = match[1];

    // Skip known non-component patterns
    if (
      name.startsWith('create') ||  // Factory functions
      name.startsWith('get') ||      // Getters
      name.startsWith('use') ||      // Hooks (custom hooks start with 'use')
      name.startsWith('is') ||       // Boolean checks
      name.startsWith('has') ||      // Boolean checks
      name.startsWith('load') ||     // Loaders
      name.startsWith('save') ||     // Savers
      name.startsWith('format') ||   // Formatters
      name.startsWith('validate') || // Validators
      name.startsWith('check')       // Checkers
    ) {
      continue;
    }

    // Check if this function returns JSX (has < inside after the declaration)
    const afterFunction = content.substring(match.index);
    const nextNL = afterFunction.indexOf('\n');
    const functionBody = afterFunction.substring(0, 300); // Check first 300 chars

    if (/<[a-zA-Z]/.test(functionBody)) {
      warnings.push({
        file: filePath,
        line: lines.slice(0, match.index).filter(l => !l.startsWith('//') && !l.startsWith('*')).length + 1,
        message: `Component "${name}" starts with lowercase. Consider renaming to "${name.charAt(0).toUpperCase() + name.slice(1)}" for consistency.`,
      });
    }
  }
}

/**
 * Check for vite.config.js with correct React globals
 */
function checkViteConfig(pluginDir) {
  const configPath = path.join(pluginDir, 'vite.config.js');

  if (!fs.existsSync(configPath)) {
    warnings.push({
      file: 'vite.config.js',
      message: 'vite.config.js not found. Plugin may not build correctly.',
    });
    return;
  }

  const config = fs.readFileSync(configPath, 'utf-8');

  // Check for correct React global name
  if (config.includes('"React"') || config.includes("'React'")) {
    issues.push({
      file: 'vite.config.js',
      line: 1,
      message: 'React global should be "__REACT__" not "React".',
      fix: 'globals: { react: "__REACT__", "react-dom": "__REACT__" }'
    });
  }

  if (!config.includes('__REACT__')) {
    issues.push({
      file: 'vite.config.js',
      line: 1,
      message: 'React global not configured. Add: globals: { react: "__REACT__" }',
    });
  }
}

/**
 * Main validation function
 */
function validatePlugin(pluginDir) {
  log(`\n🔍 Validating plugin at: ${pluginDir}\n`, 'blue');

  if (!fs.existsSync(pluginDir)) {
    logError(`Directory not found: ${pluginDir}`);
    process.exit(1);
  }

  // Find all TypeScript/JavaScript files
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const files = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and dist
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (extensions.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  walkDir(pluginDir);

  logInfo(`Found ${files.length} source files\n`);

  // Check vite.config.js first
  checkViteConfig(pluginDir);

  // Check each file
  for (const file of files) {
    const relativePath = path.relative(pluginDir, file);
    const content = fs.readFileSync(file, 'utf-8');

    // Skip node_modules and dist
    if (relativePath.includes('node_modules') || relativePath.includes('dist')) {
      continue;
    }

    checkJsxScope(relativePath, content);
    checkHooks(relativePath, content);
    checkComponentNames(relativePath, content);
  }

  // Report results
  log('='.repeat(60));

  if (issues.length === 0 && warnings.length === 0) {
    logSuccess('No issues found! Plugin looks good.');
    log('\n💡 Tips:', 'blue');
    log('   • Remember to call getReact() before using JSX');
    log('   • Use React.useState() instead of useState()');
    log('   • Internal components must start with uppercase letter');
    return;
  }

  if (issues.length > 0) {
    log(`\n❌ Found ${issues.length} issue(s):\n`, 'red');
    issues.forEach((issue, i) => {
      log(`   ${i + 1}. ${issue.file}${issue.line ? `:${issue.line}` : ''}`, 'yellow');
      log(`      ${issue.message}`, 'red');
      if (issue.fix) {
        log(`      Fix: ${issue.fix}`, 'green');
      }
      log('');
    });
  }

  if (warnings.length > 0) {
    log(`\n⚠️  Found ${warnings.length} warning(s):\n`, 'yellow');
    warnings.forEach((warning, i) => {
      log(`   ${i + 1}. ${warning.file}${warning.line ? `:${warning.line}` : ''}`, 'yellow');
      log(`      ${warning.message}`, 'yellow');
      log('');
    });
  }

  log('='.repeat(60));
  log('\n📚 For more info, see the Troubleshooting section in README.md\n', 'blue');

  process.exit(issues.length > 0 ? 1 : 0);
}

// Run validation
const pluginDir = process.argv[2] || path.join(__dirname, '..');

validatePlugin(pluginDir);
