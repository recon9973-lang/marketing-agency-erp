# VENOM Marketing Engine (VME) — 모듈

베놈애드(**VenomAd**, `venomad.com` · 제품/플랫폼 브랜드 **Markepick** `markepick.com`)의
AI 마케팅 실행 엔진. ERP 내부 모듈로, 거래처 마케팅 업무(`WorkCategory`)를
*리서치 → 생성 → 검수 → 발행 → 성과수집 → 리포트* 파이프라인으로 자동화한다.

전체 기획: [`docs/venom-marketing-engine-plan.md`](../../../docs/venom-marketing-engine-plan.md)

## 구조

```
server/marketing/
  providers/            # 외부 연동 어댑터 (같은 인터페이스, MCP/직접API 두 경로)
    types.ts            #   공통 계약(ProviderResult, Research/Content/Creative/Publish Provider)
    naver.ts            #   네이버 DataLab·검색·순위
    seo-content.ts      #   seo-generator /api/generate → BlogDraft
    higgsfield.ts       #   이미지/숏폼/바이럴예측
    canva.ts            #   카드뉴스/썸네일
    wordpress.ts        #   WordPress.com 발행
    make.ts             #   Make 시나리오 위임 발행
  research.ts           # S2 키워드 리서치 + 성과수집 → Report.metrics + KeywordResearch DB
  compliance.ts         # S3 의료광고법 검수 게이트
  content-pipeline.ts   # S3 초안 → 검수 게이트 → ContentAsset DB 저장
  graph-insights.ts     # Graph RAG Lite — 업종 내 크로스 거래처 키워드 인사이트
  creative.ts           # S4 브리프 → kind별 provider 라우팅
  publish.ts            # S5 발행 게이트 + 채널 라우팅
  report-assembly.ts    # S6 월간 리포트 집계 + 요약 코멘트 → Report.metrics
  *.test.ts             # 상태머신·컴플라이언스·리포트 집계 단위테스트
domain/marketing/schemas.ts   # enum · zod · 파이프라인 상태머신
app/api/marketing/cron/route.ts  # 성과수집 배치 트리거(secret 보호)
server/jobs/keyword-rank.ts   # 경량 순위배치 래퍼 (naverResearch.rankCheck로 통합)
```

## 이중 실행 모델

| 경로 | 트리거 | 연동 |
|---|---|---|
| 에이전트 | 스튜디오 UI 요청 | Claude + MCP(네이버·Higgsfield·Canva·WordPress·Make) |
| 서버·크론 | 정기 배치 | provider 어댑터가 외부 Open API 직접 호출 |

크리에이티브는 MCP 1순위, 발행은 WordPress REST + Make 위임. 자격증명은 서버 밖으로 미유출(계정 참조만 전달).

## 환경변수

```
NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET   # 검색·DataLab
MARKETING_CRON_SECRET                                 # 크론 보호
SEO_GENERATOR_URL                                     # 콘텐츠 초안
HIGGSFIELD_API_URL / HIGGSFIELD_API_KEY               # (서버경로 선택) 크리에이티브
CANVA_ACCESS_TOKEN                                    # (서버경로 후속)
WORDPRESS_API_TOKEN / WORDPRESS_SITE                  # WordPress 발행
MAKE_WEBHOOK_URL                                      # Make 위임 발행
```

미설정 시 provider는 `CONFIG_MISSING`으로 안전 실패(배치 무중단).

## 진행 상태

- [x] S0 기획 / S1 스캐폴딩 / S2 리서치·성과수집 / S3 콘텐츠+의료광고법 / S4 크리에이티브 / S5 발행·배포 / S6 리포트 자동조립
- [x] `docs/venom-marketing-engine-schema.prisma` → `prisma/schema.prisma` 병합 + `prisma migrate` 완료
- [x] 스튜디오 UI(`app/(erp)/studio/`) + server actions(ActionResult/RBAC/audit 연동) 완료
- [x] `research.ts` `collectKeywordResearch()` → `KeywordResearch` 모델 DB 저장 (clientId 제공 시)
- [x] `content-pipeline.ts` `runBlogDraftPipeline()` → `ContentAsset` 모델 DB 저장 (clientId 제공 시)
- [x] **Graph RAG Lite** `graph-insights.ts` — 업종 내 크로스 거래처 키워드 인사이트 (3-홉 Prisma 탐색)
- [x] `keyword-rank.ts` → `naverResearch.rankCheck()` 통합 (`KW_PROXY_URL` 의존 제거)

## 남은 작업

- [ ] provider 실키 주입 후 e2e 검증 (네이버 API 키·SEO Generator·Higgsfield 키 설정 후 스튜디오 UI 실동작 확인)

> **배치 표준 경로**: `research.ts`의 `runMonthlyPerformanceCollection()` — 트렌드·경쟁강도 포함.
> `keyword-rank.ts`의 `runMonthlyKeywordCollection()`은 순위만 필요한 경량 대안.
> 두 경로 모두 `naverResearch.rankCheck()` 단일 provider 사용.
