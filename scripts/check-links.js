const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (['.git', 'node_modules'].includes(entry)) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (entry.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}

walk(root);

let broken = false;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const regex = /(href|src)="(?!https?:|mailto:|data:|#)([^"#]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[2].includes('{{')) continue;
    const target = match[2].startsWith('/')
      ? path.join(root, match[2])
      : path.resolve(dir, match[2]);
    if (!fs.existsSync(target)) {
      console.error(`Broken link in ${path.relative(root, file)}: ${match[2]}`);
      broken = true;
    }
  }
}

if (broken) {
  process.exit(1);
} else {
  console.log('All local links OK');
}
