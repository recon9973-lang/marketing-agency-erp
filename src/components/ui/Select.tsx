import { forwardRef, type SelectHTMLAttributes } from "react";
import { controlBaseClass, controlInvalidClass, cx } from "@/components/ui/cx";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  /** 옵션을 데이터로 넘기거나 children으로 직접 구성할 수 있다. */
  options?: SelectOption[];
  placeholder?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, options, placeholder, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx(controlBaseClass, "pr-8", invalid && controlInvalidClass, className)}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))
        : children}
    </select>
  );
});
