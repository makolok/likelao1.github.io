const CACHE_NAME = 'lao-quiz-v2';
const assetsToCache = [
  './',
  './index.html',
  './category5.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './back.png',
  './next.png',
  './a.png',
  './b.png',
  './c.png',
  './d.png',
  './Phetsarath-OT.woff',
  './ABC.txt',
  './A.txt',
  './AB.txt',
  './B.txt',
  './CDBC.txt'
];

// ติดตั้งและแคชไฟล์ทั้งหมด
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
  self.skipWaiting();
});

// ล้างแคชเก่าเมื่อมีการอัปเดตเวอร์ชัน
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ดึงข้อมูลจากแคชเมื่อไม่มีอินเทอร์เน็ต
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});