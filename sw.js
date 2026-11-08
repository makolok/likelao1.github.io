const CACHE_NAME = 'lao-quiz-cache-v3';

// รายชื่อไฟล์ข้อสอบหลักทั้งหมดที่มีในระบบ
const QUIZ_FILES = ['ABC.txt', 'A.txt', 'AB.txt', 'B.txt', 'CDBC.txt'];

// 1. เมื่อติดตั้ง Service Worker ให้ดาวน์โหลดไฟล์หลักและข้อสอบเก็บไว้ล่วงหน้า
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // โหลดหน้าเว็บหลักและไฟล์ข้อสอบเก็บไว้ก่อน
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

// 2. เปิดใช้งานและเคลียร์แคชเก่า
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

// 3. ดักจับการ Fetch พร้อมเทคนิคแอบโหลดรูปภาพล่วงหน้าอัตโนมัติ
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    if (requestUrl.pathname.match(/\.(png|jpg|jpeg|svg|woff|txt|css|js)$/i)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {
                    // กรณีออฟไลน์
                });
            })
        );
    } else {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});