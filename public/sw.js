/* Let Me Finish service worker: offline lessons and tools. Never caches API calls or conversation content. */
const BUILD = new URL(self.location).searchParams.get("v") || "dev";
const CACHE = "lmf-" + BUILD;
const SHELL = ["/", "/home", "/talk", "/practice", "/library", "/support", "/settings", "/progress", "/journeys", "/today", "/privacy"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("lmf-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match(req.mode === "navigate" ? "/home" : req, { ignoreSearch: true })))
  );
});
