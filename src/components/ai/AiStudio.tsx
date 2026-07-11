"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Sparkles, Trash2 } from "lucide-react";
import { deleteAiContent, generateAiContent } from "@/server/actions/ai-content";
import type { AiContentItem } from "@/server/repositories/ai-content";

type ClientOption = { id: string; name: string };

const KIND_OPTIONS = [
  { value: "BLOG", label: "블로그 원고", hint: "네이버 블로그 정보성 포스트" },
  { value: "CARD_NEWS", label: "카드뉴스", hint: "인스타 카드 6~8장 원고" },
  { value: "SNS", label: "SNS 캡션", hint: "인스타/페북 캡션 + 해시태그" },
  { value: "AD_COPY", label: "광고 문구", hint: "헤드라인·디스크립션 후보" },
  { value: "KEYWORD", label: "SEO 키워드", hint: "핵심/롱테일 키워드 제안" }
] as const;

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KIND_OPTIONS.map((k) => [k.value, k.label])
);

const inputCls =
  "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

export function AiStudio({
  clients,
  history,
  aiConfigured
}: {
  clients: ClientOption[];
  history: AiContentItem[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<string>("BLOG");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      kind,
      topic: String(fd.get("topic") || ""),
      keywords: String(fd.get("keywords") || "") || null,
      tone: String(fd.get("tone") || "") || null,
      clientId: String(fd.get("clientId") || "") || null
    };
    start(async () => {
      const res = await generateAiContent(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {!aiConfigured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI가 아직 연결되지 않았습니다. <b>연동 화면</b>에서 <code className="rounded bg-white px-1 font-mono text-[11px]">ANTHROPIC_API_KEY</code>를 Vercel 환경 변수에 넣고 재배포하면 실제 생성이 켜집니다. (키가 없어도 아래 폼은 미리 볼 수 있어요.)
        </div>
      ) : null}

      <form action={onSubmit} className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {KIND_OPTIONS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={
                kind === k.value
                  ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-slate-600 hover:bg-surface"
              }
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          {KIND_OPTIONS.find((k) => k.value === kind)?.hint}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">거래처 (선택)</span>
            <select name="clientId" className={inputCls} defaultValue="">
              <option value="">연계 안 함</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">톤앤매너 (선택)</span>
            <input name="tone" placeholder="예: 신뢰감 있고 전문적인, 친근한 반말" className={inputCls} />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-500">주제 / 핵심 메시지 *</span>
          <textarea
            name="topic"
            required
            rows={3}
            placeholder="예: 겨울철 면역력 관리 한의원 보약, 20~40대 직장인 타깃"
            className={`${inputCls} resize-y`}
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-500">강조 키워드 (선택, 쉼표로 구분)</span>
          <input name="keywords" placeholder="예: 면역력, 보약, 한의원, 직장인 건강" className={inputCls} />
        </label>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {pending ? "AI가 작성 중…" : `${KIND_LABEL[kind]} 생성`}
          </button>
          {pending ? (
            <span className="text-xs text-slate-500">모델이 콘텐츠를 만들고 있어요. 10~30초 정도 걸릴 수 있습니다.</span>
          ) : null}
        </div>
      </form>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">생성 기록 ({history.length})</h3>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
            아직 생성한 콘텐츠가 없습니다. 위에서 첫 콘텐츠를 만들어 보세요.
          </p>
        ) : (
          history.map((item) => <ResultCard key={item.id} item={item} />)
        )}
      </section>
    </div>
  );
}

function ResultCard({ item }: { item: AiContentItem }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 미지원 환경은 조용히 무시 */
    }
  }

  function onDelete() {
    if (!confirm("이 생성 결과를 삭제할까요?")) return;
    start(async () => {
      const res = await deleteAiContent({ id: item.id });
      if (!res.ok) return alert(res.error);
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">
          {KIND_LABEL[item.kind] ?? item.kind}
        </span>
        {item.clientName ? (
          <span className="rounded-md border border-line px-2 py-1 text-xs text-slate-600">📎 {item.clientName}</span>
        ) : null}
        <span className="text-xs text-slate-400">{dateFmt.format(new Date(item.createdAt))} · {item.authorName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "복사됨" : "복사"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> 삭제
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-ink">{item.topic}</p>
      {item.keywords ? <p className="mt-0.5 text-xs text-slate-500">키워드: {item.keywords}</p> : null}
      <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-surface/70 p-3 font-sans text-sm leading-relaxed text-ink">
        {item.result}
      </pre>
    </article>
  );
}
