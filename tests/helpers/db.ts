import { vi } from "vitest";

/**
 * Prisma 모델 mock 헬퍼 (V2 §1 테스트 인프라).
 * 자주 쓰는 메서드를 vi.fn()으로 채워 반복 mock 코드를 줄인다.
 */
export function mockModel() {
  return {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  };
}

/**
 * 지정한 모델 이름들로 구성된 db mock을 만든다.
 * 예: `const db = createDbMock(["accessScope", "client"])`
 */
export function createDbMock<Name extends string>(modelNames: Name[]) {
  return Object.fromEntries(modelNames.map((name) => [name, mockModel()])) as Record<
    Name,
    ReturnType<typeof mockModel>
  >;
}
