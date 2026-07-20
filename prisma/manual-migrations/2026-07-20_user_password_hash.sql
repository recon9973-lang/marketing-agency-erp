-- 관리자 로그인 비밀번호(scrypt 해시) 컬럼. 빌드 시 db push/additive-sync가
-- 놓쳐 운영 DB에 미반영되어 비밀번호 변경이 P2022로 실패하던 것을 멱등 보강.
BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

COMMIT;
