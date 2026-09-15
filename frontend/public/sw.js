// Minimal service worker — exists only to satisfy Chrome/Android's PWA
// installability + Web Share Target requirements (an installed, standalone
// PWA needs a registered service worker before Android will register it as a
// share target). Deliberately does NOT implement an offline cache: this app
// talks to a live local investigation backend, and a cached/stale copy of
// pages that claim real forensic results would be actively misleading. Every
// fetch is left to the network exactly as if no service worker existed.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
