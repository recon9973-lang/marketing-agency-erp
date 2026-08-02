import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

// 버전별 변경 이력 — 사이드바 버전 표시를 누르면 오는 화면
export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold">변경 이력</h2>
        <p className="mt-1 text-sm text-slate-500">
          현재 버전 <span className="font-bold text-blue-600">v{APP_VERSION}</span> — 업데이트마다 무엇이
          바뀌었는지 기록합니다.
        </p>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((e) => (
          <section key={e.version} className="rounded-xl border bg-white p-5">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  e.version === APP_VERSION ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                v{e.version}
              </span>
              <h3 className="text-sm font-bold">{e.title}</h3>
              <span className="text-xs text-slate-400">{e.date}</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              {e.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
