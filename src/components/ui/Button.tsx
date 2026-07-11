// V2 §1 공통 UI — Button
// 기존 화면의 primary 버튼 스타일(bg-[#533afd])을 기준으로 variant/size 공통화.
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand/50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "border border-line bg-white text-ink hover:bg-surface",
  ghost: "text-ink hover:bg-surface",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; children?: ReactNode }) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
