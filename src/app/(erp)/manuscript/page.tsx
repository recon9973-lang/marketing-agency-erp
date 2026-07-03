// 원고 스튜디오 — public/studio.html(단일 파일 앱)을 ERP 셸 안에 임베드한다.
// 기획→집필→이미지/카드뉴스→키워드→검수→발행까지 한 화면에서.
export const metadata = {
  title: "원고 스튜디오"
};

export default function ManuscriptStudioPage() {
  return (
    // 셸의 패딩(p-4/sm:p-6)을 상쇄해 스튜디오가 콘텐츠 영역을 꽉 채우도록.
    <div className="-m-4 h-[calc(100vh-73px)] sm:-m-6">
      <iframe
        src="/studio.html"
        title="원고 스튜디오"
        className="h-full w-full border-0"
      />
    </div>
  );
}
