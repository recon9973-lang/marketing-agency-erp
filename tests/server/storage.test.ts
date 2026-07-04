import { afterEach, describe, expect, it, vi } from "vitest";
import { currentStorageDriver, persistBytes, readBytes, removeBytes } from "@/server/storage";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("currentStorageDriver", () => {
  it("defaults to db and honors valid overrides", () => {
    vi.stubEnv("STORAGE_DRIVER", "");
    expect(currentStorageDriver()).toBe("db");
    vi.stubEnv("STORAGE_DRIVER", "blob");
    expect(currentStorageDriver()).toBe("blob");
    vi.stubEnv("STORAGE_DRIVER", "nonsense");
    expect(currentStorageDriver()).toBe("db");
  });
});

describe("db driver (default)", () => {
  it("stores bytes inline and reads them back", async () => {
    vi.stubEnv("STORAGE_DRIVER", "db");
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const persisted = await persistBytes({ key: "vault/x", data: bytes, mimeType: "application/octet-stream" });

    expect(persisted.storageDriver).toBe("db");
    expect(persisted.storageRef).toBeNull();
    expect(persisted.inline).toEqual(bytes);

    const read = await readBytes({ storageDriver: "db", storageRef: null, data: persisted.inline });
    expect(Array.from(read)).toEqual([1, 2, 3, 4]);

    // db 정리는 no-op(네트워크 호출 없음)
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await removeBytes({ storageDriver: "db", storageRef: null, data: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads empty when data is missing", async () => {
    const read = await readBytes({ storageDriver: "db", storageRef: null, data: null });
    expect(read.length).toBe(0);
  });
});

describe("blob driver", () => {
  it("uploads via BLOB token and reads via returned url", async () => {
    vi.stubEnv("STORAGE_DRIVER", "blob");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "tok");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://blob/x" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([9, 8]), { status: 200 }));

    const persisted = await persistBytes({ key: "vault/x", data: new Uint8Array([1]), mimeType: "image/png" });
    expect(persisted.storageDriver).toBe("blob");
    expect(persisted.storageRef).toBe("https://blob/x");
    expect(persisted.inline).toBeNull();

    const read = await readBytes({ storageDriver: "blob", storageRef: "https://blob/x", data: null });
    expect(Array.from(read)).toEqual([9, 8]);

    const [uploadUrl, init] = fetchSpy.mock.calls[0];
    expect(String(uploadUrl)).toContain("blob.vercel-storage.com");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("throws when the blob token is missing", async () => {
    vi.stubEnv("STORAGE_DRIVER", "blob");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    await expect(
      persistBytes({ key: "k", data: new Uint8Array([1]), mimeType: "x" })
    ).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
