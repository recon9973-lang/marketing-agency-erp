// VENOM 워드마크 로고 — 검정/흰색 자동 대응 + 브랜드 오렌지 액센트 도트.
// 크기는 폰트 사이즈(className의 text-*)로 제어하고, 도트는 em 기준으로 함께 스케일된다.

export function BrandLogo({
  tone = "light",
  className = "",
  animateDot = false
}: {
  /** light: 밝은 배경용(검정 글자) · dark: 어두운 배경용(흰 글자) */
  tone?: "light" | "dark";
  className?: string;
  /** 오렌지 액센트 도트에서 링이 퍼지는 이팩트(로딩 등). 기본 off. */
  animateDot?: boolean;
}) {
  const wordColor = tone === "dark" ? "#ffffff" : "#18202f";
  const dotSize = { width: "0.23em", height: "0.23em" };
  return (
    <span
      role="img"
      aria-label="VENOM"
      className={`inline-flex items-start font-black leading-none tracking-tight ${className}`}
      style={{ color: wordColor }}
    >
      VENOM
      {animateDot ? (
        // 도트 자리에서 오렌지 링이 퍼지고(ping) 도트 본체는 부드럽게 맥동(pulse)
        <span
          aria-hidden
          className="relative ml-[0.05em] mt-[0.04em] inline-block shrink-0"
          style={dotSize}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
          <span className="absolute inset-0 animate-pulse rounded-full bg-brand" />
        </span>
      ) : (
        <span
          aria-hidden
          className="ml-[0.05em] mt-[0.04em] inline-block shrink-0 rounded-full bg-brand"
          style={dotSize}
        />
      )}
    </span>
  );
}
