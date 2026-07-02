import { forwardRef, type InputHTMLAttributes } from "react";
import { controlBaseClass, controlInvalidClass, cx } from "@/components/ui/cx";

export type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  invalid?: boolean;
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { invalid, className, inputMode = "numeric", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode={inputMode}
      aria-invalid={invalid || undefined}
      className={cx(controlBaseClass, invalid && controlInvalidClass, className)}
      {...props}
    />
  );
});
