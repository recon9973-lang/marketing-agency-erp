-- 개인 즐겨찾기(페이지 북마크). 멱등 추가.
BEGIN;
CREATE TABLE IF NOT EXISTS "UserFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserFavorite_userId_href_key" ON "UserFavorite" ("userId", "href");
CREATE INDEX IF NOT EXISTS "UserFavorite_userId_idx" ON "UserFavorite" ("userId");
COMMIT;
