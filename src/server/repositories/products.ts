// 목표 경로: src/server/repositories/products.ts
//
// 대행 상품 마스터 조회.
import { db } from "@/server/db";

export type ProductItem = { id: string; name: string; category: string };

/** 활성 상품 목록(계약 상품 구성 드롭다운용). */
export async function listActiveProducts(): Promise<ProductItem[]> {
  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true }
  });
  return rows;
}
