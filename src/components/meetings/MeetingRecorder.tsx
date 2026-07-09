"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";
import { generateMeetingMinutesAction } from "@/server/actions/meetings";

// Vercel 서버리스 본문 제한(약 4.5MB) 여유분.
const SIZE_LIMIT = 4_300_000;

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MeetingRecorder({
  meetingId,
  transcribeConfigured,
  aiConfigured,
  initialTranscript
}: {
  meetingId: string;
  transcribeConfigured: boolean;
  aiConfigured: boolean;
  initialTranscript: string;
}) {
  const router = useRouter();
  const [transcript, setTranscript] = useState(initialTranscript);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<"idle" | "transcribing" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function pickMime(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 24000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        void transcribe(blob);
      };
      rec.start(1000);
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("마이크 권한이 필요합니다. 브라우저에서 마이크 접근을 허용해 주세요.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function transcribe(blob: Blob) {
    if (blob.size > SIZE_LIMIT) {
      setError(
        `녹음이 너무 깁니다(${(blob.size / 1_000_000).toFixed(1)}MB). 회의를 나눠 녹음하거나, 아래에 메모를 붙여넣어 회의록을 만드세요.`
      );
      return;
    }
    setPhase("transcribing");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("audio", blob, "meeting.webm");
      const res = await fetch("/api/meetings/transcribe", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; transcript?: string; error?: string };
      if (!res.ok || !data.ok || !data.transcript) {
        setError(data.error || "음성 변환에 실패했습니다.");
        return;
      }
      setTranscript((prev) => (prev ? `${prev}\n${data.transcript}` : data.transcript!));
    } catch {
      setError("음성 변환 중 오류가 발생했습니다.");
    } finally {
      setPhase("idle");
    }
  }

  function generate() {
    if (!transcript.trim()) {
      setError("회의 내용(녹음 변환 또는 메모)이 필요합니다.");
      return;
    }
    setError(null);
    setPhase("generating");
    start(async () => {
      const res = await generateMeetingMinutesAction({ id: meetingId, transcript });
      setPhase("idle");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const busy = phase !== "idle" || pending;

  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={busy || !transcribeConfigured}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Mic className="h-4 w-4" /> 녹음 시작
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white"
          >
            <Square className="h-4 w-4" /> 정지 · {mmss(seconds)}
          </button>
        )}
        {recording ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> 녹음 중
          </span>
        ) : null}
        {phase === "transcribing" ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 음성을 텍스트로 변환 중…
          </span>
        ) : null}
        {!transcribeConfigured ? (
          <span className="text-xs text-amber-700">
            음성 변환을 켜려면 OPENAI_API_KEY 등록 필요 — 그 전엔 아래에 메모를 붙여넣어 회의록을 만들 수 있어요.
          </span>
        ) : null}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-500">회의 내용 (녹음 변환 결과 · 직접 수정/붙여넣기 가능)</label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={8}
          placeholder="녹음을 정지하면 여기에 자동으로 채워집니다. 또는 회의 메모를 직접 붙여넣어도 됩니다."
          className="mt-1 w-full resize-y rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy || !aiConfigured || !transcript.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {phase === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {phase === "generating" ? "회의록 작성 중…" : "AI 회의록 생성"}
        </button>
        {!aiConfigured ? <span className="text-xs text-amber-700">AI 회의록은 ANTHROPIC_API_KEY 필요</span> : null}
      </div>
    </div>
  );
}
