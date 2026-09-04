var CACHE_NAME = 'bna-v3-20260904-3rf8m';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/og-logo.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {
        return Promise.all(
          STATIC_ASSETS.map(function(url) {
            return cache.add(url).catch(function() {});
          })
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// Network-first for every same-origin GET: always try the fresh copy first,
// fall back to cache only when offline, and update the cache on success.
// This guarantees newly published content shows up WITHOUT a hard refresh.
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function(resp) {
      if (resp && resp.status === 200) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      }
      return resp;
    }).catch(function() {
      return caches.match(e.request).then(function(hit) {
        if (hit) return hit;
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes(self.location.origin) && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SET_BADGE') {
    if ('setAppBadge' in self.navigator) {
      var count = e.data.count || 0;
      if (count > 0) {
        self.navigator.setAppBadge(count);
      } else {
        self.navigator.clearAppBadge();
      }
    }
  }
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title || 'Bharat Naukri Alert', {
      body: e.data.body || 'New update available',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: e.data.tag || 'bna-update',
      data: { url: e.data.url || '/' }
    });
  }
});
