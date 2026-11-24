import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'node:crypto';

export default defineConfig({
  base: '',
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: 'inline-all',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        const htmlPath = resolve(dist, 'index.html');
        let html = readFileSync(htmlPath, 'utf-8');

        // 匹配 Vite 输出的外部样式标签，捕获构建目录内的资源路径。
        html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
          const css = readFileSync(resolve(dist, href), 'utf-8');
          unlinkSync(resolve(dist, href));
          return `<style>${css}</style>`;
        });

        // 匹配 Vite 输出的模块脚本标签，捕获需要内联的脚本路径。
        html = html.replace(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
          const js = readFileSync(resolve(dist, src), 'utf-8');
          unlinkSync(resolve(dist, src));
          return `<script type="module">${js}</script>`;
        });

        writeFileSync(htmlPath, html, 'utf-8');

        // 对最终页面和安装资源求摘要，任一资源更新都会生成新的缓存版本。
        const assets = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
        const workerPath = resolve(dist, 'sw.js');
        const worker = readFileSync(workerPath, 'utf-8');
        const hash = createHash('sha256').update(worker);
        for (const asset of assets) hash.update(readFileSync(resolve(dist, asset)));
        writeFileSync(workerPath, worker.replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 16)));
      },
    },
  ],
});
