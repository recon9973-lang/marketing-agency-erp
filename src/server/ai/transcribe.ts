// 음성 → 텍스트(STT). OpenAI 오디오 전사 API 사용(whisper-1 기본).
// 키는 이미지와 같은 OPENAI_API_KEY 공유. 실패/미설정 시 명확한 에러.
const OPENAI_TRANSCRIBE_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

// OpenAI 전사 API 파일 상한(25MB). 실제로는 Vercel 함수 본문 제한(약 4.5MB)이 먼저 걸린다.
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export function isTranscribeConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** 오디오(File/Blob)를 받아 한국어 우선으로 전사한 텍스트를 반환. */
export async function transcribeAudio(file: File | Blob): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("TRANSCRIBE_NOT_CONFIGURED");
  if (file.size === 0) throw new Error("EMPTY_AUDIO");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("AUDIO_TOO_LARGE");

  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";
  const form = new FormData();
  const named = file instanceof File ? file : new File([file], "meeting.webm", { type: "audio/webm" });
  form.set("file", named);
  form.set("model", model);
  form.set("language", "ko");
  form.set("response_format", "json");

  const res = await fetch(OPENAI_TRANSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  const data = (await res.json().catch(() => null)) as { text?: string; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(data?.error?.message || `전사 오류 (HTTP ${res.status})`);
  const text = (data?.text ?? "").trim();
  if (!text) throw new Error("EMPTY_TRANSCRIPT");
  return text;
}
