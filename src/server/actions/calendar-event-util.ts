// 캘린더 일정 순수 유틸(서버 액션 파일과 분리 — "use server" 모듈은 async export만 허용).

/** KST 로컬 입력(YYYY-MM-DD, HH:mm)을 UTC Date로. 서버 TZ 무관하게 KST(+09:00) 오프셋 적용. */
export function kstToUtc(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00+09:00`);
}
