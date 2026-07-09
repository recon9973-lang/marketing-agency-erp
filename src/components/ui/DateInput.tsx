import { forwardRef, type InputHTMLAttributes } from "react";
import { controlBaseClass, controlInvalidClass, cx } from "@/components/ui/cx";

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  invalid?: boolean;
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { invalid, className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type="date"
      aria-invalid={invalid || undefined}
      className={cx(controlBaseClass, invalid && controlInvalidClass, className)}
      {...props}
    />
  );
});
