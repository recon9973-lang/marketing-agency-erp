-- 채팅(1:1/채널). 멱등 — 각 문장 개별 실행(runner가 실패 무시). 트랜잭션 없이.
CREATE TYPE "ChatRoomType" AS ENUM ('DIRECT', 'GROUP');
CREATE TABLE IF NOT EXISTS "ChatRoom" ("id" TEXT NOT NULL, "type" "ChatRoomType" NOT NULL DEFAULT 'DIRECT', "name" TEXT, "clientId" TEXT, "createdById" TEXT, "lastMessageAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "ChatRoom_lastMessageAt_idx" ON "ChatRoom" ("lastMessageAt");
CREATE TABLE IF NOT EXISTS "ChatMember" ("id" TEXT NOT NULL, "roomId" TEXT NOT NULL, "userId" TEXT NOT NULL, "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastReadAt" TIMESTAMP(3), CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "ChatMember_roomId_userId_key" ON "ChatMember" ("roomId", "userId");
CREATE INDEX IF NOT EXISTS "ChatMember_userId_idx" ON "ChatMember" ("userId");
CREATE TABLE IF NOT EXISTS "ChatMessage" ("id" TEXT NOT NULL, "roomId" TEXT NOT NULL, "senderId" TEXT NOT NULL, "body" TEXT NOT NULL, "fileId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "ChatMessage_roomId_createdAt_idx" ON "ChatMessage" ("roomId", "createdAt");
