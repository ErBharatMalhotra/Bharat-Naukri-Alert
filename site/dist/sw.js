var CACHE_NAME = 'bna-v2';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/search-index.json',
  '/robots.txt',
  '/sitemap.xml',
  '/rss.xml',
  '/category/job.html',
  '/category/scholarship.html',
  '/category/exam.html',
  '/category/scheme.html',
  '/category/admit-card.html',
  '/category/result.html',
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

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname === '/search-index.json') {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
        return resp;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        if (resp.status === 200 && url.origin === self.location.origin) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      });
    }).catch(function() {
      if (e.request.destination === 'document' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return caches.match('/index.html');
      }
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
