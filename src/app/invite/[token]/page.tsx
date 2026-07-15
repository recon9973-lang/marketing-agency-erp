// 개인 로그인 링크 진입점 — 이메일(SMTP) 없이 직원을 로그인시킨다.
// 관리자가 /invite/{token} 링크를 카톡/문자로 전달 → 받은 사람이 열면 자동 로그인.
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/server/auth";
import { AutoSubmit } from "./AutoSubmit";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  async function activate() {
    "use server";
    try {
      // 성공 시 세션 쿠키 설정 + /dashboard 로 리다이렉트. 잘못된 링크면 로그인 화면으로.
      await signIn("login-link", { token, redirectTo: "/dashboard" });
    } catch (error) {
      if (error instanceof AuthError) redirect("/login?error=invite");
      throw error; // NEXT_REDIRECT 등은 그대로 전파
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0c0b0f] px-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <div className="text-2xl font-black tracking-tight">
          VENOM<span className="text-brand">•</span>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">MARKETING ERP</p>

        <h1 className="mt-6 text-lg font-bold">환영합니다 👋</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          아래 버튼을 누르면 바로 로그인되고 ERP를 사용할 수 있습니다.
        </p>

        <form id="invite-form" action={activate} className="mt-6">
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(217,102,46,0.8)] transition hover:bg-brand-strong"
          >
            로그인하고 시작하기 →
          </button>
          <AutoSubmit />
        </form>

        <p className="mt-5 text-[11px] leading-5 text-white/40">
          앱처럼 쓰려면: 브라우저 메뉴에서 <b className="text-white/70">&ldquo;홈 화면에 추가&rdquo;</b>(아이폰) /
          <b className="text-white/70"> &ldquo;앱 설치&rdquo;</b>(안드로이드·PC)를 눌러 설치하세요.
        </p>
      </div>
    </main>
  );
}
