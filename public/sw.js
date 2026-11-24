const cachePrefix = `json-editor:${self.registration.scope}:`;
const cacheName = `${cachePrefix}__BUILD_VERSION__`;
const appUrl = new URL('./', self.registration.scope).href;
const pageUrl = new URL('index.html', appUrl).href;
const assets = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']
  .map((path) => new URL(path, appUrl).href);

self.addEventListener('install', (event) => {
  // 所有资源成功缓存后才允许安装；失败时保留旧版本。更新等待旧窗口关闭后生效。
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(
    assets.map((url) => new Request(url, { cache: 'reload' }))
  )));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  // 仅处理应用入口和明确列出的静态资源，不缓存用户文件或其他站点请求。
  const target = event.request.mode === 'navigate' && (url.href === appUrl || url.href === pageUrl)
    ? pageUrl
    : assets.includes(url.href) ? url.href : null;
  if (!target) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(target) || fetch(event.request);
  })());
});
