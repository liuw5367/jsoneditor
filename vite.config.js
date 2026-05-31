import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

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

        html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
          const css = readFileSync(resolve(dist, href), 'utf-8');
          unlinkSync(resolve(dist, href));
          return `<style>${css}</style>`;
        });

        html = html.replace(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
          const js = readFileSync(resolve(dist, src), 'utf-8');
          unlinkSync(resolve(dist, src));
          return `<script type="module">${js}</script>`;
        });

        writeFileSync(htmlPath, html, 'utf-8');
      },
    },
  ],
});
