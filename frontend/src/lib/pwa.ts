// Registers the minimal service worker (public/sw.js) that Android requires
// before it will treat this installed PWA as a Web Share Target. No-op in
// browsers without SW support and in contexts without a secure origin
// (registration itself just silently rejects — nothing here needs to branch
// on that, `.catch` covers it).
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service workers require a secure context (HTTPS, or localhost/LAN-IP
      // dev origins are treated as secure by browsers) — if registration
      // fails for any other reason, the app still works, just not
      // installable/share-targetable. Never surface this as a user error.
    })
  })
}
