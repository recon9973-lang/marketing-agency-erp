export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand">ERP Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">역할별 운영 화면 준비 중</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          대시보드 집계와 위젯은 다음 작업에서 연결됩니다. 지금은 인증과 역할 기반 셸이 정상적으로 동작하는지
          확인할 수 있는 최소 화면입니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["거래처 현황", "업무 진행", "정산 알림"].map((title) => (
          <div key={title} className="rounded-md border border-line bg-white p-5">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-3 text-sm text-slate-500">데이터 연결 전 placeholder</p>
          </div>
        ))}
      </div>
    </section>
  );
}
