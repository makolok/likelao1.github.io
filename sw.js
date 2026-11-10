const CACHE_NAME = 'lao-quiz-cache-v4'; // 🟢 เปลี่ยนชื่อเป็น v4 เพื่อบังคับเคลียร์แคชเดิม[cite: 8]

const QUIZ_FILES = ['ABC.txt', 'A.txt', 'AB.txt', 'B.txt', 'CDBC.txt'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                './',
                './index.html',
                './category5.html',
                './style.css',
                './reminder-style.css',
                './reminder-widget.js',
                './app.js',
                ...QUIZ_FILES
            ]);
        })
    );
    self.skipWaiting();
});

// 2. เคลียร์แคชเก่า ออกจากเครื่องทันที
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. ปรับให้ไฟล์ JS, HTML ดึงจากเน็ตก่อน (Network First)
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.pathname.match(/\.(js|html)$/i)) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => caches.match(event.request))
        );
    } else if (requestUrl.pathname.match(/\.(png|jpg|jpeg|svg|woff|txt|css)$/i)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {});
            })
        );
    } else {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});