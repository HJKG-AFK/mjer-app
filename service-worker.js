const CACHE_NAME = &#39;mjer-cache-v1.4&#39;; // 更新缓存版本号
 const urlsToCache = [
  &#39;./&#39;, // 缓存仓库根目录 (通常会加载 index.html)
  &#39;./index.html&#39;,
  &#39;./manifest.json&#39;, // 缓存 manifest 文件
  // 如果您有本地图标并且希望它们被强力缓存，也应在此处列出它们的相对路径
  // 例如: &#39;./icons/icon-192.png&#39;, &#39;./icons/icon-512.png&#39;,
  // CDN 资源会自动被浏览器缓存，但也可以明确列出以供离线优先策略
  &#39;https://cdn.tailwindcss.com&#39;,
  &#39;https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap&#39;
  // Google Fonts API 本身以及它返回的 CSS 和字体文件通常有自己的缓存策略。
  // 明确缓存字体 URL 可能比较复杂，因为它们可能是动态的或有版本。
 ];

self.addEventListener('install', event =\> {
event.waitUntil(
caches.open(CACHE\_NAME)
.then(cache =\> {
console.log('美记 ServiceWorker: Opened cache, caching files:', urlsToCache);
// 使用 map 为每个请求创建一个新的 Request 对象，并设置 cache: 'reload'
// 来确保从网络获取最新的资源进行初始缓存。
const requests = urlsToCache.map(url =\> new Request(url, { cache: 'reload' }));
return cache.addAll(requests)
.then(() =\> console.log('美记 ServiceWorker: All files cached successfully.'))
.catch(error =\> {
console.error('美记 ServiceWorker: Failed to cache some files during install:', error);
// 可以尝试分别缓存，找出哪个URL失败
urlsToCache.forEach(url =\> {
cache.add(new Request(url, { cache: 'reload' })).catch(err =\> console.error(`Failed to cache ${url}:`, err));
});
});
})
.catch(error =\> {
console.error('美记 ServiceWorker: Failed to open cache during install:', error);
})
);
self.skipWaiting(); // 强制新的 Service Worker 立即激活
});

self.addEventListener('activate', event =\> {
event.waitUntil(
caches.keys().then(cacheNames =\> {
return Promise.all(
cacheNames.map(cacheName =\> {
if (cacheName \!== CACHE\_NAME) {
console.log('美记 ServiceWorker: Deleting old cache:', cacheName);
return caches.delete(cacheName);
}
})
);
}).then(() =\> {
console.log('美记 ServiceWorker: Activated and old caches cleaned.');
return self.clients.claim(); // 让当前 Service Worker 控制所有打开的客户端
})
);
});

self.addEventListener('fetch', event =\> {
// 对于导航请求 (例如，用户直接访问页面或刷新)，采用网络优先策略，确保用户总是能获取到最新的 HTML。
if (event.request.mode === 'navigate') {
event.respondWith(
fetch(event.request)
.then(response =\> {
// 如果网络请求成功，克隆响应并将其存入缓存，然后返回网络响应。
if (response && response.status === 200) {
const responseToCache = response.clone();
caches.open(CACHE\_NAME).then(cache =\> {
cache.put(event.request, responseToCache);
});
}
return response;
})
.catch(() =\> {
// 如果网络失败 (例如，离线)，则尝试从缓存中获取。
console.log('美记 ServiceWorker: Fetch failed for navigation, trying cache for:', event.request.url);
return caches.match(event.request);
})
);
return;
}

// 对于其他所有请求 (CSS, JS, 图像等)，采用缓存优先策略。
event.respondWith(
caches.match(event.request)
.then(response =\> {
// 如果在缓存中找到匹配的响应，则直接返回它。
if (response) {
return response;
}
// 如果缓存中没有，则从网络获取。
return fetch(event.request).then(
networkResponse =\> {
// 确保我们只缓存有效的响应。
if (\!networkResponse || networkResponse.status \!== 200 ||
(networkResponse.type \!== 'basic' && networkResponse.type \!== 'cors')) { // 允许缓存 CORS 请求
return networkResponse;
}
// 克隆响应并将其存入缓存，然后返回网络响应。
const responseToCache = networkResponse.clone();
caches.open(CACHE\_NAME)
.then(cache =\> {
cache.put(event.request, responseToCache);
});
return networkResponse;
}
).catch(error =\> {
console.error('美记 ServiceWorker: Fetch failed for asset, no cache match:', event.request.url, error);
// 可选: 返回一个通用的离线占位符资源 (例如，一个离线图标或图像)
// if (event.request.destination === 'image') return caches.match('./offline-placeholder.png');
});
})
);
});