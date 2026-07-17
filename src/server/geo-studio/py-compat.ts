// GEO Studio 이식 공통 — 파이썬 호환 유틸.
//
// 원본(M1~M5)은 Python이라 곳곳에서 내장 `round()`(banker's rounding, 절반→짝수)를 쓴다.
// JS의 Math.round/toFixed(절반→올림 or 소수 오차)와 결과가 달라 골든 동등성을 깨므로,
// 파이썬 `round(x, ndigits)`를 문자열(십진) 기반으로 충실히 재현한다.
// IEEE 엣지까지 일치: round(26.05,1)=26.1, round(2.55,1)=2.5, round(0.25,1)=0.2, round(2.675,2)=2.67.

/** Python `round(x, ndigits)` 재현(절반→짝수, 실제 double의 십진값 기준). */
export function pyRound(x: number, ndigits = 0): number {
  if (!Number.isFinite(x)) return x;
  if (x === 0) return 0;
  const neg = x < 0;
  // double의 실제 십진값을 충분히 드러낸다(20자리면 nd≤2 판정에 충분).
  const s = Math.abs(x).toFixed(20);
  const dot = s.indexOf(".");
  const intPart = s.slice(0, dot);
  const frac = s.slice(dot + 1);
  if (ndigits >= frac.length) return x;

  const keep = frac.slice(0, Math.max(0, ndigits));
  const rest = frac.slice(Math.max(0, ndigits)); // 반올림 위치 이후 전체
  let digits = intPart + keep; // 소수점 제거한 정수 자릿수열

  const first = rest.charCodeAt(0) - 48; // rest[0]
  let roundUp: boolean;
  if (first > 5) roundUp = true;
  else if (first < 5) roundUp = false;
  else {
    const after = rest.slice(1).replace(/0+$/, "");
    if (after.length > 0) roundUp = true; // > .5
    else {
      // 정확히 .5 → 직전(유지) 자릿수가 홀수면 올림(짝수로)
      const lastKept = digits.length ? digits.charCodeAt(digits.length - 1) - 48 : 0;
      roundUp = lastKept % 2 === 1;
    }
  }

  let intVal = BigInt(digits || "0");
  if (roundUp) intVal += 1n;

  let result: number;
  if (ndigits <= 0) {
    // ndigits==0. (ndigits<0는 원본에서 미사용)
    result = Number(intVal.toString());
  } else {
    let numStr = intVal.toString().padStart(ndigits + 1, "0");
    const p = numStr.length - ndigits;
    result = Number(numStr.slice(0, p) + "." + numStr.slice(p));
  }
  if (result === 0) return 0; // -0 정규화(파이썬 round(-0.5)=0)
  return neg ? -result : result;
}
