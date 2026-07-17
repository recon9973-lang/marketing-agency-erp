import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export default async function HomePage() {
  const session = await auth();

  // 로그인된 사용자는 역할에 따라 자동 리다이렉트
  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role === "CLIENT") {
      redirect("/portal/dashboard");
    } else if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-xl">
        <p className="text-sm font-semibold text-brand">Venom Marketing ERP</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-ink">업무 운영 시스템</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          이메일 로그인 후 역할별 대시보드에서 거래처, 업무, 일정, 정산, 휴가, 보고서를 관리합니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex h-11 items-center rounded-md bg-brand px-5 text-sm font-semibold text-white">
            로그인
          </Link>
        </div>
      </section>
    </main>
  );
}
