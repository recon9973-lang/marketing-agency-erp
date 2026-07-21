-- 셀프 가입(PENDING) — UserStatus enum에 PENDING 값 보강(멱등).
-- 이 값이 없으면 requestSignup의 user.create가 invalid enum 오류로 실패한다.
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING';
