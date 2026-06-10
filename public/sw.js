// ============================================================================
// HAANG POS - PROGRESSIVE WEB APP SERVICE WORKER
// ============================================================================

const CACHE_NAME = 'haang-pos-cache-v1';

// Static resources to pre-cache immediately on service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event: Precaches essential application shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching app shell assets...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Force immediate activation representation
      return self.skipWaiting();
    })
  );
});

// Activate Event: Cleans up obsolete caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Directs caching and network request handling
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Bypass Service Worker entirely for Supabase database/auth requests and external dynamic APIs
  if (
    requestUrl.origin.includes('supabase.co') || 
    requestUrl.pathname.startsWith('/api/') ||
    event.request.method !== 'GET'
  ) {
    return; // Let browser make standard network requests
  }

  // 2. Dynamic caching strategies
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return pre-cached static files instantly
        // Also fire off a non-blocking fetch in the background to revalidate static assets (Stale-While-Revalidate)
        if (PRECACHE_ASSETS.includes(requestUrl.pathname)) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {/* Ignore silent background update failures due to offline status */});
        }
        return cachedResponse;
      }

      // Handle external web fonts (Google Fonts) and Unsplash product images dynamically using Cache-First
      const isFont = requestUrl.hostname.includes('fonts.gstatic.com') || requestUrl.hostname.includes('fonts.googleapis.com');
      const isUnsplash = requestUrl.hostname.includes('images.unsplash.com');

      if (isFont || isUnsplash) {
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // Failure fallback for fonts or unsplash images
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      }

      // 3. For any other regular app asset, try the Network, fallback to app shell / cache
      return fetch(event.request).then((networkResponse) => {
        // Cache valid responses dynamically
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline Fallback for html pages
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Internet Connection Lost', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});

// Listener for force upgrade messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
