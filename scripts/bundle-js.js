const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');

async function main() {
  await esbuild.build({
    entryPoints: [path.join(root, 'scripts', 'pretext-notes.entry.js')],
    outfile: path.join(root, 'assets', 'js', 'pretext-notes.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    logLevel: 'info',
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
