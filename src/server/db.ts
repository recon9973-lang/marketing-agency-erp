import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Neon 서버리스 드라이버(WebSocket) — Vercel 서버리스에서 매 요청 TCP+TLS 핸드셰이크 대신
// 경량 연결로 버튼 지연을 크게 줄인다. $transaction(인터랙티브)을 쓰므로 HTTP가 아닌 WS 어댑터.
// Node 런타임에서는 WebSocket 생성자를 주입해야 한다.
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const logLevels = (process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]) as ("query" | "error" | "warn")[];

function createClient(): PrismaClient {
  // 풀드 엔드포인트(DATABASE_URL) 우선. 어댑터 구성 실패 시 기본 클라이언트로 폴백(느리지만 동작).
  const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (connectionString) {
    try {
      const adapter = new PrismaNeon({ connectionString });
      return new PrismaClient({ adapter, log: logLevels });
    } catch {
      /* 폴백 */
    }
  }
  return new PrismaClient({ log: logLevels });
}

// 웜 서버리스 인스턴스에서 PrismaClient를 재사용(연결 낭비/고갈 방지).
export const db = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma = db;
