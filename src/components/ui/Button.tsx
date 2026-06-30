import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand/90",
  secondary: "border border-line bg-white text-ink hover:bg-surface",
  ghost: "text-slate-600 hover:bg-surface",
  danger: "bg-danger text-white hover:bg-danger/90"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", type = "button", className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(base, variantClasses[variant], sizeClasses[size], className)}
      {...props}
    />
  );
});
