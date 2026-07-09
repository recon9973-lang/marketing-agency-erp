/** className 결합 유틸. falsy 값은 무시한다. */
export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** 폼 컨트롤(Input/Select/Textarea/Number/Date) 공통 스타일. */
export const controlBaseClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60";

/** 오류 상태일 때 추가되는 테두리 스타일. */
export const controlInvalidClass = "border-danger focus:border-danger focus-visible:ring-danger/30";
