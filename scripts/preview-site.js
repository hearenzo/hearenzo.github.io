const fs = require('fs');
const http = require('http');
const path = require('path');
const { Liquid } = require('liquidjs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, '.preview');
const includeDir = path.join(root, '_includes');
const layoutDir = path.join(root, '_layouts');
const portArgIndex = process.argv.indexOf('--port');
const port = portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : 48901;
const shouldBuildOnly = process.argv.includes('--build');
const shouldServe = process.argv.includes('--serve') || !shouldBuildOnly;
const skipDirs = new Set([
  '.git',
  '.github',
  '.vscode',
  '.bundle',
  '.preview',
  'node_modules',
  'vendor',
  '_includes',
  '_layouts',
  '_data',
  'scripts'
]);

const liquid = new Liquid({
  root,
  partials: includeDir,
  dynamicPartials: false
});

liquid.registerFilter('jsonify', (value) => JSON.stringify(value));
liquid.registerFilter('date', (value, format) => formatDate(value, format));

function formatDate(value, format) {
  const date = value === 'now' ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const tokens = {
    '%Y': String(date.getFullYear()),
    '%m': String(date.getMonth() + 1).padStart(2, '0'),
    '%d': String(date.getDate()).padStart(2, '0'),
    '%H': String(date.getHours()).padStart(2, '0'),
    '%M': String(date.getMinutes()).padStart(2, '0'),
    '%S': String(date.getSeconds()).padStart(2, '0')
  };

  return String(format || '%Y-%m-%d').replace(/%[YmdHMS]/g, (token) => tokens[token] || token);
}

function parseFrontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;

  const data = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  }

  return {
    data,
    content: source.slice(match[0].length)
  };
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(dest);
  fs.copyFileSync(src, dest);
}

function toPageUrl(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'index.html'.length)}`;
  }
  return `/${normalized}`;
}

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    const relative = path.relative(root, full);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walk(full, callback);
    } else {
      callback(full, relative);
    }
  }
}

async function renderHtmlFile(sourcePath, relativePath) {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const frontMatter = parseFrontMatter(raw);

  if (!frontMatter) {
    return raw;
  }

  const page = {
    ...frontMatter.data,
    url: toPageUrl(relativePath)
  };

  const content = await liquid.parseAndRender(frontMatter.content, { page });

  if (!page.layout) {
    return content;
  }

  const layoutPath = path.join(layoutDir, `${page.layout}.html`);
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  return liquid.parseAndRender(layoutSource, { page, content });
}

async function buildPreview() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const htmlFiles = [];

  walk(root, (sourcePath, relativePath) => {
    const outputPath = path.join(outDir, relativePath);
    if (relativePath.endsWith('.html')) {
      htmlFiles.push([sourcePath, relativePath, outputPath]);
      return;
    }
    copyFile(sourcePath, outputPath);
  });

  for (const [sourcePath, relativePath, outputPath] of htmlFiles) {
    const rendered = await renderHtmlFile(sourcePath, relativePath);
    ensureDir(outputPath);
    fs.writeFileSync(outputPath, rendered);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8'
  };
  return types[ext] || 'application/octet-stream';
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalized = cleanPath === '/' ? '/index.html' : cleanPath;
  const candidate = path.join(outDir, normalized);

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const nested = path.join(candidate, 'index.html');
    if (fs.existsSync(nested)) return nested;
  }

  if (!path.extname(candidate)) {
    const htmlCandidate = `${candidate}.html`;
    if (fs.existsSync(htmlCandidate)) return htmlCandidate;
    const nestedIndex = path.join(candidate, 'index.html');
    if (fs.existsSync(nestedIndex)) return nestedIndex;
  }

  return null;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const filePath = resolveRequestPath(req.url || '/');

    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Preview running at http://127.0.0.1:${port}`);
  });
}

async function main() {
  await buildPreview();
  console.log(`Preview build written to ${outDir}`);

  if (shouldServe) {
    startServer();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
