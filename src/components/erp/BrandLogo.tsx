// VENOM 워드마크 로고 — 검정/흰색 자동 대응 + 브랜드 오렌지 액센트 도트.
// 크기는 폰트 사이즈(className의 text-*)로 제어하고, 도트는 em 기준으로 함께 스케일된다.

export function BrandLogo({
  tone = "light",
  className = ""
}: {
  /** light: 밝은 배경용(검정 글자) · dark: 어두운 배경용(흰 글자) */
  tone?: "light" | "dark";
  className?: string;
}) {
  const wordColor = tone === "dark" ? "#ffffff" : "#18202f";
  return (
    <span
      role="img"
      aria-label="VENOM"
      className={`inline-flex items-start font-black leading-none tracking-tight ${className}`}
      style={{ color: wordColor }}
    >
      VENOM
      <span
        aria-hidden
        className="ml-[0.05em] mt-[0.04em] inline-block shrink-0 rounded-full bg-brand"
        style={{ width: "0.23em", height: "0.23em" }}
      />
    </span>
  );
}
