import { readFile, rm, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'dist');
const htmlPath = resolve(outputDirectory, 'index.html');
let html = await readFile(htmlPath, 'utf8');
const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);

if (!scriptMatch || !styleMatch) {
  throw new Error('离线构建失败：未找到入口脚本或样式资源。');
}

const scriptPath = resolve(outputDirectory, scriptMatch[1]);
const stylePath = resolve(outputDirectory, styleMatch[1]);
// A data-module avoids both file:// module loading restrictions and accidental
// closing tags that may occur inside bundled framework string literals.
const script = await readFile(scriptPath, 'utf8');
const scriptDataUrl = `data:text/javascript;base64,${Buffer.from(script).toString('base64')}`;
const style = (await readFile(stylePath, 'utf8')).replace(/<\/style/gi, '<\\/style');
html = html.replace(scriptMatch[0], `<script type="module">import(${JSON.stringify(scriptDataUrl)}).catch((error) => console.error('离线模块启动失败', error));</script>`);
html = html.replace(styleMatch[0], `<style>${style}</style>`);
await writeFile(htmlPath, html, 'utf8');
await rm(resolve(outputDirectory, 'assets'), { recursive: true, force: true });
