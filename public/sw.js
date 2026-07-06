/* venom ERP 서비스 워커 — 설치형 앱(PWA)용.
 * 안전 원칙: GET·동일출처만 처리. /api(로그인·인증) 및 POST(서버액션)는 절대 가로채지 않음.
 * 네비게이션은 network-first(+오프라인 폴백), 정적 자원은 cache-first. */
const CACHE = "venom-erp-v2";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return; // 인증/서버 라우트는 항상 네트워크

  // 페이지 이동: 최신 우선, 실패 시 캐시된 홈으로 폴백
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // 정적 자원(_next, 이미지, 폰트 등): 캐시 우선
  const isStatic = url.pathname.startsWith("/_next/") || /\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|woff2?)$/.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
