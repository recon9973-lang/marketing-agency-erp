# NAS 연동 런북 (A. 데이터 이관 · B. 파일 저장소)

> 두 가지 모두 **코드는 준비 완료**. 실행은 `team.db`·프로덕션 DB·NAS에 접근 가능한 환경(사장님 PC/서버)에서 수행한다.
> (개발 샌드박스는 프로덕션 DB·NAS 미접근 → 실행 불가. 이 문서로 직접 실행.)

---

## A. NAS 팀 앱 데이터 → ERP 이관

`scripts/migrate-nas-to-erp.ts` (멱등·dry-run 기본, 9 tests 통과).

이관 대상: 거래처(Client) · 계정(ClientAccount, 평문비번 제외·힌트만) · 체크리스트(WorkItem) · 메모(Comment). 직원은 사전 매핑(신규 생성 안 함).

### 준비물
1. **team.db** — NAS 팀 앱 SQLite 파일 (NAS에서 export)
2. **NAS 실제 스키마 확인** — `scripts/migrate-nas-to-erp.ts`의 `NAS_SCHEMA`는 추정값. 실물과 맞춰야 함:
   ```
   sqlite3 team.db ".tables"     # 테이블 목록
   sqlite3 team.db ".schema"     # 컬럼까지
   ```
   → 실제 테이블/컬럼명이 다르면 `NAS_SCHEMA`의 우변(이름)을 수정.
3. **staff-map.json** — NAS 직원ID → ERP User.id 매핑:
   ```json
   {
     "staffIdMap": { "1": "erp-user-id-홍길동", "2": "erp-user-id-김마케터" },
     "fallbackUserId": "erp-user-id-관리자",
     "encryptCredentials": false
   }
   ```
   - ERP User.id는 `/직원권한` 화면 또는 DB(User 테이블)에서 확인.
   - `encryptCredentials: true`면 계정 비번힌트를 암호화 저장(→ `CREDENTIAL_ENC_KEY` env 필요).
4. **better-sqlite3 설치**: `pnpm add -D better-sqlite3`
5. **프로덕션 DB 접근**: `.env`에 프로덕션 `DATABASE_URL`(Neon) — ⚠️ 실데이터에 씀.

### 실행 (반드시 dry-run 먼저)
```bash
# 1) 미리보기 — DB 미변경, 이관 건수만 출력
tsx scripts/migrate-nas-to-erp.ts --db ./team.db --staff-map ./staff-map.json

# 2) 결과 확인 후 실제 반영
tsx scripts/migrate-nas-to-erp.ts --db ./team.db --staff-map ./staff-map.json --commit
```
- 재실행해도 `nas-<종류>-<원본id>`로 upsert → **중복 안 생김**(멱등).
- 이관 후 `/clients`에서 거래처·계정·업무·메모 확인.

### 안전
- 평문 비밀번호는 **이관하지 않음**(힌트만). 실제 비번은 ERP에서 다시 입력.
- `--commit` 전 반드시 dry-run 건수 확인. 프로덕션 DB 백업 권장.

---

## B. NAS를 파일 저장소(S3 호환)로 연결

`src/server/storage/s3.ts`가 커스텀 엔드포인트를 이미 지원. **코드 변경 없이 env만** 설정.
미설정 시 업로드는 DB(StoredFile)로 폴백(작동은 함).

### 전제 — Vercel(클라우드)이 NAS에 닿아야 함 ⚠️
Vercel 서버가 NAS의 S3 API에 **HTTPS로 접근 가능**해야 한다. NAS가 집/사무실 공유기 뒤(NAT)면 그대로는 불가.
- ✅ 방법 1: NAS에 **MinIO**(Docker) 설치 + DSM 리버스 프록시로 **공개 도메인 + Let's Encrypt HTTPS** + 포트포워딩
- ✅ 방법 2: **시놀로지 오브젝트 스토리지**(패키지) 사용 + 공개 HTTPS
- ✅ 방법 3(가장 쉬움): NAS 대신 **Cloudflare R2 / 시놀로지 C2 오브젝트** (클라우드라 바로 도달, 저렴)
- ❌ QuickConnect·Tailscale·사설IP는 Vercel에서 도달 불가

### 설정 (Vercel → Environment Variables)
| 이름 | 값(예시) |
|---|---|
| `STUDIO_S3_ENDPOINT` | `https://s3.mynas.example.com` (NAS의 공개 S3 URL) |
| `STUDIO_S3_BUCKET` | `venom-assets` |
| `STUDIO_S3_ACCESS_KEY_ID` | (MinIO/NAS 액세스 키) |
| `STUDIO_S3_SECRET_ACCESS_KEY` | (시크릿) |
| `STUDIO_S3_REGION` | `us-east-1` (MinIO는 아무 값이나) |
| `STUDIO_S3_FORCE_PATH_STYLE` | `true` (MinIO/NAS 필수) |
| `STUDIO_S3_PUBLIC_BASE_URL` | (공개 CDN/도메인 base, 선택) |

→ 저장 후 **재배포** → `/integrations`의 "에셋 저장소(S3)"가 **연결됨**으로 바뀌면 완료.
→ 이미지·디자인 스튜디오 업로드가 NAS로 저장됨.

### 검증
- `/integrations` → 에셋 저장소 초록불
- 이미지 스튜디오에서 이미지 업로드 → NAS 버킷에 파일 생성 확인
- 실패 시 대부분 **엔드포인트 미도달(방화벽/HTTPS)** 또는 `FORCE_PATH_STYLE` 누락

---

## 제가 도와드릴 수 있는 것
- **A**: NAS `.schema` 출력 + 직원 목록 주시면 → `NAS_SCHEMA` 실물 맞춤 수정 + `staff-map.json` 생성.
- **B**: 코드 준비 완료. NAS S3 엔드포인트만 마련되면 env 값 세팅 도와드림.
