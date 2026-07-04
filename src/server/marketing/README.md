# VENOM Marketing Engine (VME) — 모듈

베놈애드(**VenomAd**, `venomad.com` · 제품/플랫폼 브랜드 **Markepick** `markepick.com`)의
AI 마케팅 실행 엔진. ERP 내부 모듈로, 거래처 마케팅 업무(`WorkCategory`)를
*리서치 → 생성 → 검수 → 발행 → 성과수집 → 리포트* 파이프라인으로 자동화한다.

전체 기획: [`docs/venom-marketing-engine-plan.md`](../../../docs/venom-marketing-engine-plan.md)

## 구조

```
server/marketing/
  providers/       # 외부 연동 어댑터 (같은 인터페이스, MCP/직접API 두 경로)
    types.ts       #   공통 계약(ProviderResult, Research/Content/Creative/Publish Provider)
    naver.ts       #   네이버 DataLab·검색·순위 (서버 직접 API 구현)
    seo-content.ts #   seo-generator /api/generate 재사용 → BlogDraft 매핑
  research.ts      # S2: 키워드 리서치 + 보고서 성과수집 → Report.metrics
  compliance.ts    # S3: 의료광고법 검수 게이트(규칙기반)
  content-pipeline.ts # S3: 초안 생성 → 검수 게이트 → 스테이지/판정
  compliance.test.ts
  README.md
domain/marketing/
  schemas.ts       # enum 상수 · zod 입력검증 · 파이프라인 상태머신
  schemas.test.ts
app/api/marketing/
  cron/route.ts    # 성과수집 배치 트리거(secret 보호)
```

## 이중 실행 모델

| 경로 | 트리거 | 연동 방식 |
|---|---|---|
| 에이전트 | 스튜디오 UI에서 담당자 요청 | Claude 세션 + MCP(PlayMCP 네이버·Higgsfield·Canva·WordPress·Make) |
| 서버·크론 | 정기 배치(순위/성과 수집) | provider 어댑터가 외부 Open API 직접 호출 (`api/marketing/cron`) |

→ provider 인터페이스가 두 경로를 흡수한다. 크론은 세션 MCP를 못 쓰므로 직접-API 구현이 필수.

## 환경변수

```
NAVER_SEARCH_CLIENT_ID=""       # 네이버 검색·DataLab
NAVER_SEARCH_CLIENT_SECRET=""
MARKETING_CRON_SECRET=""        # 성과수집 크론 라우트 보호 헤더
SEO_GENERATOR_URL=""            # 배포된 seo-generator 베이스 URL(콘텐츠 초안)
# (S4+) HIGGSFIELD_API_KEY, CANVA_*, WORDPRESS_*, MAKE_WEBHOOK_URL
```

미설정 시 provider는 throw 하지 않고 `CONFIG_MISSING` 결과를 반환한다(배치 안전).

## 컴플라이언스 (S3 구현됨)

병원 고객 비중이 크므로 모든 의료 블로그/리뷰는 발행 전 `compliance.ts` 검수 게이트를 통과한다.
- **BLOCK**(치료효과 보장·단정, 근거 없는 최상급/유일성) → 발행 차단, `COMPLIANCE_REVIEW`에서 정지.
- **WARN**(환자유인 이벤트/할인, 비교광고, 효과 언급 시 부작용·주의 병기 누락) → 진행하되 findings 검토 권고.
- 규칙 근거: `seo-writing-skill/references/medical-compliance.md`(의료법 제56·57조).
- 1차 자동 게이트이며 사람 검토를 대체하지 않는다.

## 진행 상태

- [x] S0 기획
- [x] S1 스캐폴딩 — provider 계약·도메인 스키마·네이버 어댑터·Prisma fragment·상태머신.
- [x] S2 리서치·성과수집 — `research.ts`, 크론 라우트, 상태머신 테스트.
- [x] S3 콘텐츠 파이프라인 — `seo-content.ts`(seo-generator 재사용)·`compliance.ts`(의료광고법 게이트)·`content-pipeline.ts`·검수 테스트.
- [ ] S4 크리에이티브 스튜디오 (Higgsfield/Canva)
- [ ] S5 발행·배포 (WordPress/Make) · S6 리포트 자동조립

> 참고: 신규 Prisma 모델은 `docs/venom-marketing-engine-schema.prisma`에 분리 보관.
> S2·S3는 마이그레이션 없이 동작(성과는 Report.metrics, 콘텐츠 초안은 구조화 반환).
