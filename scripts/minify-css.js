const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'assets', 'css', 'styles.css');
const outputPath = path.join(__dirname, '..', 'assets', 'css', 'styles.min.css');

try {
  const css = fs.readFileSync(inputPath, 'utf8');
  const minified = css
    .replace(/\/\*[^]*?\*\//g, '') // remove comments
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\s*([:;{},])\s*/g, '$1') // remove spaces around tokens
    .replace(/;}/g, '}') // remove last semicolons
    .trim();
  fs.writeFileSync(outputPath, minified + '\n');
  console.log(`Minified CSS written to ${outputPath}`);
} catch (err) {
  console.error('CSS minification failed:', err);
  process.exit(1);
}
