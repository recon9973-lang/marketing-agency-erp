import { forwardRef, type TextareaHTMLAttributes } from "react";
import { controlBaseClass, controlInvalidClass, cx } from "@/components/ui/cx";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx(controlBaseClass, "resize-y", invalid && controlInvalidClass, className)}
      {...props}
    />
  );
});
