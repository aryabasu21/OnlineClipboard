self.addEventListener('install', evt => {
  self.skipWaiting();
});
self.addEventListener('activate', evt => {
  clients.claim();
});
self.addEventListener('fetch', evt => {
  // simple network-first pass-through; enhance with caching later
});
