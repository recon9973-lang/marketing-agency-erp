# 베놈 ERP 통합 지시서 — 오렌지 버전 + 마케팅 엔진(VME)

> 상황: `erp-v1`(프로덕션)에서 두 작업 세션이 서로 덮어썼다.
> - `332a7ef` (07-05 18:05) — 마케팅 엔진(VME) 머지 (PR #17)
> - `203a889` (07-05 19:39) — 오렌지 버전(erp-v2-staging-handoff)으로 erp-v1 통째 교체 → VME 덮임
>
> 결과: 현재 erp-v1 = **오렌지 버전만**(VME 빠짐). VME는 브랜치
> `claude/venom-marketing-program-rlkqbl`(=커밋 `332a7ef`)에 **안전 보존**.
>
> 목표: **오렌지 UI/테넌트 + 마케팅 스튜디오(VME)가 함께** 있는 erp-v1.
> 이 병합은 로컬 git에서 한 곳(오렌지 세션)에서만 수행한다(동시 작업 금지).

---

## 1) 병합 (로컬)

```bash
git checkout erp-v1 && git pull
git checkout -b claude/erp-orange-plus-vme
git merge claude/venom-marketing-program-rlkqbl
```

VME는 대부분 신규 파일이라 충돌은 아래 **2곳**뿐(+ 상황에 따라 lockfile).

## 2) 충돌 해결 ① `prisma/schema.prisma`

오렌지 스키마는 유지하고, VME 것을 **추가만** 한다.

- **enum 4개 추가**: `ContentType`, `PipelineStage`, `ComplianceVerdict`, `PublishChannel`
- **model 4개 추가**(VME 브랜치 정의 그대로): `KeywordResearch`, `ContentAsset`, `CreativeAsset`, `PublishJob`
- **기존 모델 역참조 필드 추가**:
  - `Client`        += `keywordResearch KeywordResearch[]`, `contentAssets ContentAsset[]`, `creativeAssets CreativeAsset[]`
  - `WorkItem`      += `keywordResearch KeywordResearch[]`, `contentAssets ContentAsset[]`
  - `User`          += `createdContentAssets ContentAsset[]`
  - `ClientAccount` += `publishJobs PublishJob[]`
- ⚠️ 오렌지가 `Organization`(테넌트)을 도입했다면, 일관성을 위해 위 4개 VME 모델에도
  `organizationId`(+관계)를 넣을지 판단. 테넌트 격리가 필요하면 추가한다.

## 3) 충돌 해결 ② `src/components/erp/AppShell.tsx`

오렌지 네비게이션 배열에 항목 하나만 추가('원고 스튜디오' 다음쯤).

- lucide import에 `Sparkles` 추가
- `ErpRoute` 타입에 `"/studio"` 추가
- nav 항목 추가:
  `{ href: "/studio", label: "마케팅 스튜디오", roles: [SUPER_ADMIN, ADMIN, MARKETER], icon: Sparkles }`

## 4) 병합 후 반드시 확인

1. `src/server/actions/marketing.ts`가 쓰는 것들이 오렌지에도 존재/호환되는지:
   `_helpers`(runAction/requireUser/recordAudit/requestMeta/getAdminScopes),
   `assertCanAccessClient`, `getCurrentUser`. 시그니처가 바뀌었으면 맞춘다.
2. `src/app/(erp)/studio/page.tsx`의 `db.client.findMany`가 오렌지의 테넌트
   (`organizationId`) 스코프를 따라야 하면 `where`에 조건 추가.
3. `pnpm prisma generate && pnpm build && pnpm vitest run` 통과.
4. DB: 통합 스키마로 새 마이그레이션 생성
   `pnpm prisma migrate dev --name add_vme_to_orange`.

## 5) VME 신규 파일(병합 시 자동 편입되어야 함)

```
src/domain/marketing/schemas.ts (+ schemas.test.ts)
src/server/marketing/providers/{types,naver,seo-content,higgsfield,canva,wordpress,make}.ts
src/server/marketing/{research,compliance,content-pipeline,creative,publish,report-assembly}.ts
src/server/marketing/{compliance.test.ts,report-assembly.test.ts,README.md}
src/server/actions/marketing.ts
src/app/api/marketing/cron/route.ts
src/app/(erp)/studio/{page.tsx,StudioClient.tsx}
docs/venom-marketing-engine-plan.md
docs/venom-marketing-engine-schema.prisma
.claude/skills/plan-research/SKILL.md
```

## 6) 통합 완료 후

- 빌드 그린이면 `erp-v1`로 병합 → Vercel 자동배포 = **오렌지 + 마케팅 엔진** 완성.
- ⚠️ **DB 주의**: Neon `neon-red-elephant`는 마케팅 세션에서 `prisma migrate reset`으로
  초기화되어 현재 **VME 세션 스키마 + 데모 시드** 상태(오렌지 전용 테이블은 빠졌을 수 있음).
  통합 스키마로 `prisma migrate deploy`(또는 `reset`) 재실행 필요. 프로덕션이므로 데이터 확인 후 진행.
- 환경변수(선택): `NAVER_SEARCH_CLIENT_ID/SECRET`(리서치 실작동), `MARKETING_CRON_SECRET`,
  `SEO_GENERATOR_URL`, `HIGGSFIELD_API_URL/KEY`, `CANVA_ACCESS_TOKEN`, `WORDPRESS_API_TOKEN/SITE`,
  `MAKE_WEBHOOK_URL`. 미설정 시 각 기능은 `CONFIG_MISSING`로 안전 실패.

---

## 재발 방지

- **erp-v1(프로덕션)은 한 곳에서만** 수정한다. 두 세션이 동시에 push하면 서로 덮어쓴다.
- 큰 기능은 브랜치 → PR → 병합 순서로. 프로덕션 브랜치 직접 트리 교체는 지양.
