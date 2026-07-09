import { PrismaClient } from "@prisma/client";

// 웜 서버리스 인스턴스에서 PrismaClient(=연결 풀)를 재사용한다.
// 이전에는 개발 환경에서만 전역 캐시했는데, 프로덕션(Vercel)에서도 캐시해야
// 한 인스턴스가 클라이언트를 중복 생성해 Neon 연결을 낭비/고갈시키는 걸 막는다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });

globalForPrisma.prisma = db;
