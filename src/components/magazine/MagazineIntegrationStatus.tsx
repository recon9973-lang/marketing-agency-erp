// GROUND 매거진 발행 파이프라인 연동 상태 패널(서버 컴포넌트).
//
// 목적: seokorea.org 매거진 가동(#39)의 "발행 연결 점검" — 환경변수 4종이
// Vercel/ERP에 실제 등록되어 파이프라인이 살았는지 관리자단에서 즉시 확인한다.
// 자격증명 값은 노출하지 않는다(연결 여부 boolean만 읽는다).
//   · AI 초안(ANTHROPIC_API_KEY) → 큐 → 초안 자동/수동 생성
//   · 워드프레스(WORDPRESS_SITE_URL/USER/APP_PASSWORD) → seokorea.org 발행
//   · 인스타그램(선택) → 커버 있는 글 동시 발행(원소스 멀티유즈)
import { isAiConfigured } from "@/server/ai/claude";
import { wordpressConfigured } from "@/server/marketing/providers/wordpress";
import { instagramConfigured } from "@/server/marketing/providers/instagram";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Item = {
  label: string;
  ok: boolean;
  env: string;
  okHint: string;
  missingHint: string;
  optional?: boolean;
};

export function MagazineIntegrationStatus() {
  const items: Item[] = [
    {
      label: "AI 초안",
      ok: isAiConfigured(),
      env: "ANTHROPIC_API_KEY",
      okHint: "큐 → 초안 자동 생성이 켜져 있습니다.",
      missingHint: "키 등록 시 큐에서 초안이 자동 생성됩니다."
    },
    {
      label: "워드프레스 발행",
      ok: wordpressConfigured(),
      env: "WORDPRESS_SITE_URL · USER · APP_PASSWORD",
      okHint: "검토 완료 글을 seokorea.org에 발행할 수 있습니다.",
      missingHint: "3종 등록 시 seokorea.org 자동 발행이 켜집니다."
    },
    {
      label: "인스타 동시발행",
      ok: instagramConfigured(),
      env: "INSTAGRAM_ACCESS_TOKEN · INSTAGRAM_BUSINESS_ID",
      okHint: "커버가 있으면 발행 시 인스타에 함께 게시됩니다.",
      missingHint: "선택 사항 — 등록 시 원소스 멀티유즈(웹+소셜)로 확장됩니다.",
      optional: true
    }
  ];

  const ready = items.every((i) => i.optional || i.ok);

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">발행 연동 상태</p>
        <StatusBadge tone={ready ? "success" : "warning"}>
          {ready ? "발행 준비 완료" : "환경변수 등록 필요"}
        </StatusBadge>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.label} className="rounded-xl border border-line bg-surface/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">
                {i.label}
                {i.optional && <span className="ml-1 text-[10px] font-normal text-slate-400">선택</span>}
              </span>
              <StatusBadge tone={i.ok ? "success" : i.optional ? "neutral" : "warning"}>
                {i.ok ? "연결됨" : "미연결"}
              </StatusBadge>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{i.ok ? i.okHint : i.missingHint}</p>
            <p className="mt-1 font-mono text-[10px] text-slate-400">{i.env}</p>
          </li>
        ))}
      </ul>
      {!ready && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-700">
          Vercel 환경변수 등록 → 재배포 후 이 패널에서 &ldquo;연결됨&rdquo;으로 바뀝니다. 자격증명 값은 노출되지 않습니다.
        </p>
      )}
    </div>
  );
}
