# VENOM SEO Engine — 벤더링(단일 정본)

이 폴더의 두 파일은 **직접 수정하지 않습니다.** 총괄 디렉터 저장소의 정본 엔진을
그대로 내려받아 둔 사본입니다. ERP의 SEO 진단은 항상 이 엔진을 통해 수행됩니다.

| 파일 | 정본 위치 | 역할 |
|---|---|---|
| `seo-engine.cjs` | `recon9973-lang/desktop-tutorial` · `venom-wordpress/preview/seo/seo-engine.js` | 진단 엔진(의존성 0, UMD) |
| `seo-rules.json` | 동 · `venom-wordpress/preview/seo/seo-rules.json` | 규칙 29개 / 6영역 + Google 문서 근거 |

- 엔진 버전: **VENOM SEO Engine v1.7.0**
- 마지막 동기화 기준 커밋: `desktop-tutorial@96655e9`

## 항상 최신화하는 법 (파이프라인)

`scripts/sync-seo-engine.mjs`가 정본 저장소의 raw 파일을 내려받아 이 폴더를 덮어씁니다.
`npm run build`가 `next build` 직전에 이 스크립트를 실행하므로 **배포할 때마다
디렉터의 최신 엔진으로 자동 갱신**됩니다. 수동 실행:

```bash
node scripts/sync-seo-engine.mjs        # 최신본으로 덮어쓰기
node scripts/sync-seo-engine.mjs --check # 갱신 필요 여부만 확인(쓰기 없음)
```

정본이 비공개 저장소라면 `SEO_ENGINE_SYNC_TOKEN`(GitHub read 토큰)을 환경변수로 주면
raw 인증에 사용합니다. 네트워크·인증 실패 시 스크립트는 **커밋된 사본을 유지**하고
빌드를 막지 않습니다(정직 원칙: 조용한 실패 대신 로그를 남김).

> 엔진 로직·규칙을 바꿔야 하면 **디렉터 저장소에서** 고치세요. 여기서 고치면 다음 동기화에 덮어써집니다.
