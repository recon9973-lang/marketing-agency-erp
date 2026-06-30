import { forwardRef, type InputHTMLAttributes } from "react";
import { controlBaseClass, controlInvalidClass, cx } from "@/components/ui/cx";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, type = "text", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cx(controlBaseClass, invalid && controlInvalidClass, className)}
      {...props}
    />
  );
});
