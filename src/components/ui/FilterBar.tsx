import type { ReactNode } from "react";
import { Button, LinkButton } from "@/components/ui/Button";

const columnClasses: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6"
};

const footerSpanClasses: Record<number, string> = {
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6"
};

export function FilterBar({
  columns = 5,
  submitLabel = "필터 적용",
  resetHref,
  resetLabel = "초기화",
  children
}: {
  columns?: 2 | 3 | 4 | 5 | 6;
  submitLabel?: string;
  resetHref?: string;
  resetLabel?: string;
  children: ReactNode;
}) {
  return (
    <form className={`grid gap-3 rounded-md border border-line bg-white p-4 ${columnClasses[columns]}`}>
      {children}
      <div className={`flex items-end gap-2 ${footerSpanClasses[columns]}`}>
        <Button type="submit">{submitLabel}</Button>
        {resetHref ? <LinkButton href={resetHref}>{resetLabel}</LinkButton> : null}
      </div>
    </form>
  );
}
