import { copyFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const release = resolve('release');
await mkdir(release, { recursive: true });
await copyFile(resolve('dist/index.html'), resolve(release, 'AIoT智慧温室种植系统-离线答辩版.html'));
const result = await stat(resolve(release, 'AIoT智慧温室种植系统-离线答辩版.html'));
console.log(`答辩离线包已生成：${result.size} bytes`);
