-- 이메일 없이 쓰는 개인 로그인 링크(초대/직원 접속). 멱등 추가.
BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginLinkToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_loginLinkToken_key" ON "User" ("loginLinkToken");

COMMIT;
