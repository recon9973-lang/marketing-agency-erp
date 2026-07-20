/* venom ERP 서비스 워커 — 설치형 앱(PWA)용.
 * 안전 원칙: GET·동일출처만 처리. /api(인증)·POST(서버액션)는 절대 가로채지 않는다.
 * 정직성 원칙: HTML 문서는 절대 캐시에서 오래된 버전을 내주지 않는다.
 *   (스테일 문서를 서빙하면 이미 삭제된 /_next 청크를 참조 → "client-side exception"으로
 *    화면이 통째로 죽는다. 잦은 재배포 PWA의 전형적 크래시 원인.)
 *   → 문서는 항상 네트워크. 오프라인일 때만 캐시가 아닌 최소 폴백 페이지를 보여준다.
 *   → 내용해시가 박힌 불변 자원(/_next/static)만 캐시-우선(안전).
 * 캐시 이름을 올리면 activate에서 과거(스테일) 캐시가 전부 제거된다. */
const CACHE = "venom-erp-v3";

// 설치 즉시(대기 없이) 활성화 — 새 배포가 바로 반영되게.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// 활성화 시 과거 캐시(스테일 청크·스테일 문서 포함)를 전부 제거하고 제어권 확보.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 오프라인 폴백 — 스테일 앱 셸 대신 정적인 최소 페이지(죽은 청크 참조 없음).
const OFFLINE_HTML =
  '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title></head>' +
  '<body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#0c0b0f;color:#fff">' +
  '<div style="text-align:center;padding:24px"><p style="font-weight:700;margin:0 0 6px">오프라인 상태입니다</p>' +
  '<p style="opacity:.55;font-size:14px;margin:0">네트워크 연결 후 새로고침 해주세요.</p></div></body></html>';

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return; // 인증/서버 라우트는 항상 네트워크

  // 페이지 이동(HTML): 항상 네트워크. 오프라인일 때만 최소 폴백.
  // 문서를 캐시에서 서빙하지 않으므로 스테일 번들 크래시가 원천 차단된다.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () => new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } })
      )
    );
    return;
  }

  // 내용해시가 박힌 불변 자원만 캐시-우선(안전: 파일명이 바뀌면 새로 받는다).
  // 그 외(_next/data, 루트 스크립트 등)는 가로채지 않고 네트워크에 맡긴다.
  if (!url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
