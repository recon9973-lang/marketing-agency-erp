/**
 * 파일 저장 드라이버 추상화 (워크플로우 12차).
 *
 * 파일 바이트를 어디에 둘지 STORAGE_DRIVER env로 고른다:
 *   - "db"   : StoredFile.data(bytea)에 그대로 저장(기본값, 현재 동작).
 *   - "blob" : Vercel Blob에 업로드하고 URL을 storageRef에 저장.
 *   - "nas"  : NAS(HTTP/WebDAV 엔드포인트)에 저장하고 경로를 storageRef에 저장.
 *
 * 호출부(채팅·보관함·스튜디오)는 persistBytes/readBytes만 쓰므로, 이관 시 드라이버만
 * 추가하고 env를 바꾸면 된다 → 코드 재작업 없음.
 */

export type StorageDriverName = "db" | "blob" | "nas";

/** put 결과: db면 inline에 바이트, 외부면 ref에 참조. */
export type PersistResult = {
  storageDriver: StorageDriverName;
  storageRef: string | null;
  inline: Uint8Array | null;
};

/** 저장된 파일 행에서 바이트를 읽을 때 필요한 최소 필드. */
export type StoredBytesRef = {
  storageDriver?: string | null;
  storageRef: string | null;
  data: Uint8Array | Buffer | null;
};

export function currentStorageDriver(): StorageDriverName {
  const driver = process.env.STORAGE_DRIVER;
  return driver === "blob" || driver === "nas" ? driver : "db";
}

interface StorageDriver {
  persist(input: { key: string; data: Uint8Array; mimeType: string }): Promise<PersistResult>;
  read(ref: string): Promise<Uint8Array>;
  remove(ref: string): Promise<void>;
}

const dbDriver: StorageDriver = {
  async persist({ data }) {
    return { storageDriver: "db", storageRef: null, inline: data };
  },
  async read() {
    // db 드라이버는 storageRef가 없고 행의 data를 직접 쓴다. 여기 도달하면 안 됨.
    throw new Error("db 드라이버는 storageRef를 사용하지 않습니다.");
  },
  async remove() {
    // 행이 삭제되면 함께 지워지므로 별도 처리 없음.
  }
};

const blobDriver: StorageDriver = {
  async persist({ key, data, mimeType }) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.");
    const response = await fetch(`https://blob.vercel-storage.com/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": mimeType,
        "x-content-type": mimeType
      },
      body: data as unknown as BodyInit
    });
    if (!response.ok) throw new Error(`Blob 업로드 실패 (${response.status})`);
    const json = (await response.json().catch(() => ({}))) as { url?: string };
    if (!json.url) throw new Error("Blob 업로드 응답에 url이 없습니다.");
    return { storageDriver: "blob", storageRef: json.url, inline: null };
  },
  async read(ref) {
    const response = await fetch(ref);
    if (!response.ok) throw new Error(`Blob 조회 실패 (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  },
  async remove(ref) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return;
    await fetch("https://blob.vercel-storage.com/delete", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [ref] })
    }).catch(() => undefined);
  }
};

const nasDriver: StorageDriver = {
  async persist({ key, data, mimeType }) {
    const base = process.env.NAS_ENDPOINT;
    if (!base) throw new Error("NAS_ENDPOINT가 설정되지 않았습니다.");
    const url = `${base.replace(/\/$/, "")}/${key}`;
    const headers: Record<string, string> = { "Content-Type": mimeType };
    if (process.env.NAS_AUTH) headers.Authorization = process.env.NAS_AUTH;
    const response = await fetch(url, { method: "PUT", headers, body: data as unknown as BodyInit });
    if (!response.ok) throw new Error(`NAS 저장 실패 (${response.status})`);
    return { storageDriver: "nas", storageRef: url, inline: null };
  },
  async read(ref) {
    const headers: Record<string, string> = {};
    if (process.env.NAS_AUTH) headers.Authorization = process.env.NAS_AUTH;
    const response = await fetch(ref, { headers });
    if (!response.ok) throw new Error(`NAS 조회 실패 (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  },
  async remove(ref) {
    const headers: Record<string, string> = {};
    if (process.env.NAS_AUTH) headers.Authorization = process.env.NAS_AUTH;
    await fetch(ref, { method: "DELETE", headers }).catch(() => undefined);
  }
};

function driverFor(name: StorageDriverName): StorageDriver {
  if (name === "blob") return blobDriver;
  if (name === "nas") return nasDriver;
  return dbDriver;
}

/** 파일 바이트를 현재 드라이버에 저장하고, StoredFile 행에 넣을 값들을 반환. */
export async function persistBytes(input: {
  key: string;
  data: Uint8Array;
  mimeType: string;
}): Promise<PersistResult> {
  return driverFor(currentStorageDriver()).persist(input);
}

/** StoredFile 행에서 실제 바이트를 읽는다(드라이버 무관). */
export async function readBytes(file: StoredBytesRef): Promise<Uint8Array> {
  const driverName: StorageDriverName =
    file.storageDriver === "blob" || file.storageDriver === "nas" ? file.storageDriver : "db";
  if (driverName === "db") {
    return file.data ? new Uint8Array(file.data) : new Uint8Array();
  }
  if (!file.storageRef) throw new Error("외부 저장 파일에 storageRef가 없습니다.");
  return driverFor(driverName).read(file.storageRef);
}

/** 외부 저장소에 남은 파일을 정리(db면 아무 것도 안 함). */
export async function removeBytes(file: StoredBytesRef): Promise<void> {
  const driverName: StorageDriverName =
    file.storageDriver === "blob" || file.storageDriver === "nas" ? file.storageDriver : "db";
  if (driverName === "db" || !file.storageRef) return;
  await driverFor(driverName).remove(file.storageRef);
}
