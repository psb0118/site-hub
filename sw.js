/* =========================================================
   sw.js — 오프라인 셸 서비스 워커
   ---------------------------------------------------------
   네트워크 우선, 실패하면 캐시로 응답합니다.
   (허브는 자주 바뀌므로 캐시 우선으로 두면 오래된 목록이 남습니다.)
   셸 목록을 바꾸면 CACHE 이름의 버전을 올려 주세요.
========================================================= */

const CACHE = "site-hub-v1";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "sites.js",
  "auth.js",
  "manifest.webmanifest",
  "health.json",
  "icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /* 일부 파일이 없어도 설치는 계속한다 */
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === "navigate") {
          const shell = await caches.match("index.html");
          if (shell) return shell;
        }
        return Response.error();
      }
    })()
  );
});
