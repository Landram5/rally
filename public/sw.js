const CACHE = "rally-shell-v1";
const SHELL = ["/offline", "/favicon.svg", "/apple-touch-icon.png", "/icons/rally-192.png", "/icons/rally-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(fetch(request).catch(() => caches.match("/offline")));
});

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data; try { data = event.data?.json(); } catch { return; }
    if (!data || typeof data.title !== "string" || typeof data.detail !== "string" || typeof data.id !== "string" || typeof data.href !== "string") return;
    let url; try { url = new URL(data.href, self.location.origin); } catch { return; }
    if (url.origin !== self.location.origin || !data.href.startsWith("/") || data.href.startsWith("//")) return;
    await self.registration.showNotification(data.title.slice(0, 160), {
      body: data.detail.slice(0, 500), tag: data.id.slice(0, 256), icon: "/icons/rally-192.png", data: {href: url.href}
    });
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    let url; try { url = new URL(event.notification.data?.href || "/clubhouse", self.location.origin); } catch { return; }
    if (url.origin !== self.location.origin) return;
    const windows = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    const window = windows.find(client => client.url === url.href);
    if (window) await window.focus(); else await self.clients.openWindow(url.href);
  })());
});
