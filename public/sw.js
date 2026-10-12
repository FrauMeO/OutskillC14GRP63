// Deliberately minimal. This worker exists so browsers that still look for one treat the app as
// installable. It caches nothing and never touches API or signed-in responses: every request goes
// straight to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // No respondWith: the browser handles the request normally.
});
