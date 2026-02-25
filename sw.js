// Service Worker for WebP Gallery PWA
const CACHE_NAME = 'aiG-v3'; // 更新版本號強制清除舊快取
const BASE_PATH = '/aiG';
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icon-192.png`,
  `${BASE_PATH}/icon-512.png`
];

// 安裝事件：預先快取靜態資源
self.addEventListener('install', (event) => {
  console.log('[SW] 安裝中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 快取靜態資源');
        return cache.addAll(urlsToCache.filter(url => url !== `${BASE_PATH}/`));
      })
      .catch(err => {
        console.log('[SW] 快取失敗（可能某些資源不存在）:', err);
      })
  );
  self.skipWaiting();
});

// 啟動事件：清理舊快取
self.addEventListener('activate', (event) => {
  console.log('[SW] 啟動中...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 刪除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch 事件：網路優先，失敗時使用快取
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') {
    return;
  }

  // 忽略 chrome-extension 和其他非 http(s) 請求
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 如果是成功的回應，複製一份存入快取
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // 網路失敗時，嘗試從快取讀取
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] 從快取返回:', event.request.url);
              return cachedResponse;
            }
            // 如果快取也沒有，返回離線頁面
            if (event.request.destination === 'document') {
              return caches.match(`${BASE_PATH}/index.html`);
            }
          });
      })
  );
});

// 訊息事件：處理來自主頁面的訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
