// 회의 녹음 → 텍스트 전사. 브라우저 MediaRecorder가 만든 오디오를 받아
// OpenAI Whisper로 전사한 텍스트를 반환한다. (오디오는 저장하지 않음)
import { NextResponse } from "next/server";

import { hasEngineAccess } from "@/server/http/engine-auth";
import { MAX_AUDIO_BYTES, transcribeAudio } from "@/server/ai/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  if (!(await hasEngineAccess(req))) {
    return fail("인증이 필요합니다. ERP에 로그인한 상태에서 이용하세요.", 401);
  }
  if (!process.env.OPENAI_API_KEY) {
    return fail("음성 변환이 아직 연결되지 않았습니다. 연동 화면에서 OPENAI_API_KEY를 등록하면 켜집니다.", 200);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("오디오를 읽지 못했습니다.", 400);
  }
  const audio = form.get("audio");
  // File 은 Blob 을 상속하므로 Blob 체크로 둘 다 커버.
  if (!(audio instanceof Blob)) {
    return fail("오디오 파일이 없습니다.", 400);
  }
  if (audio.size === 0) return fail("녹음된 소리가 없습니다.", 400);
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail("녹음 파일이 너무 큽니다. 회의를 나눠 녹음하거나 메모 붙여넣기를 이용하세요.", 200);
  }

  try {
    const transcript = await transcribeAudio(audio);
    return NextResponse.json({ ok: true, transcript });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "UNKNOWN";
    if (raw === "AUDIO_TOO_LARGE") return fail("녹음 파일이 너무 큽니다. 회의를 나눠 녹음하세요.", 200);
    if (raw === "EMPTY_TRANSCRIPT") return fail("음성에서 텍스트를 찾지 못했습니다. 더 또렷하게 녹음해 주세요.", 200);
    return fail("음성 변환 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 200);
  }
}
