# VENOM Marketing Engine (VME) — 모듈

베놈애드(**VenomAd**, `venomad.com` · 제품/플랫폼 브랜드 **Markepick** `markepick.com`)의
AI 마케팅 실행 엔진. ERP 내부 모듈로, 거래처 마케팅 업무(`WorkCategory`)를
*리서치 → 생성 → 검수 → 발행 → 성과수집 → 리포트* 파이프라인으로 자동화한다.

전체 기획: [`docs/venom-marketing-engine-plan.md`](../../../docs/venom-marketing-engine-plan.md)

## 구조

```
server/marketing/
  providers/         # 외부 연동 어댑터 (같은 인터페이스, MCP/직접API 두 경로)
    types.ts         #   공통 계약(ProviderResult, Research/Content/Creative/Publish Provider)
    naver.ts         #   네이버 DataLab·검색·순위
    seo-content.ts   #   seo-generator /api/generate → BlogDraft
    higgsfield.ts    #   이미지/숏폼/바이럴예측
    canva.ts         #   카드뉴스/썸네일
  research.ts        # S2: 키워드 리서치 + 성과수집 → Report.metrics
  compliance.ts      # S3: 의료광고법 검수 게이트(규칙기반)
  content-pipeline.ts# S3: 초안 → 검수 게이트 → 스테이지/판정
  creative.ts        # S4: 브리프 → kind별 provider 라우팅
  *.test.ts          # 상태머신·컴플라이언스 단위테스트
domain/marketing/
  schemas.ts         # enum · zod · 파이프라인 상태머신
app/api/marketing/
  cron/route.ts      # 성과수집 배치 트리거(secret 보호)
```

## 이중 실행 모델

| 경로 | 트리거 | 연동 |
|---|---|---|
| 에이전트 | 스튜디오 UI 요청 | Claude + MCP(네이버·Higgsfield·Canva·WordPress·Make) — **크리에이티브 1순위** |
| 서버·크론 | 정기 배치 | provider 어댑터가 외부 Open API 직접 호출 |

숏폼/릴스는 **reels-creator 스킬**이 기획·카피·디자인·편집 워크플로를 담당하고, `creative.ts`가 영상 자산 생성을 실행한다.

## 환경변수

```
NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET   # 검색·DataLab
MARKETING_CRON_SECRET                                 # 크론 보호
SEO_GENERATOR_URL                                     # 콘텐츠 초안
HIGGSFIELD_API_URL / HIGGSFIELD_API_KEY               # (서버경로 선택) 크리에이티브
CANVA_ACCESS_TOKEN                                    # (서버경로 후속)
# (S5) WORDPRESS_* , MAKE_WEBHOOK_URL
```

미설정 시 provider는 `CONFIG_MISSING`으로 안전 실패(배치 무중단).

## 진행 상태

- [x] S0 기획 / S1 스캐폴딩 / S2 리서치·성과수집 / S3 콘텐츠 파이프라인+의료광고법 게이트
- [x] S4 크리에이티브 스튜디오 — Higgsfield·Canva provider + `creative.ts` 오케스트레이션
- [ ] S5 발행·배포 (WordPress/Make, PublishJob)
- [ ] S6 리포트 자동조립 (metrics→PDF)
- [ ] 공통 마무리: Prisma 모델 병합+마이그레이션, 스튜디오 UI/server actions (로컬 검증 필요)

> S2·S3·S4는 마이그레이션 없이 동작(성과=Report.metrics, 초안/크리에이티브=구조화 반환).
> 신규 Prisma 모델: `docs/venom-marketing-engine-schema.prisma`.
