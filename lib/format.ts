const comma = (n: number) => Math.round(n).toLocaleString("ko-KR");

/** 50000 → "5만원", 125000 → "12.5만원", 3000 → "3,000원" */
export function money(won: number): string {
  if (!won) return "0만원";
  if (won % 10000 === 0) return comma(won / 10000) + "만원";
  if (won >= 10000) return (won / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "만원";
  return comma(won) + "원";
}

/** 만원 단위 입력값 → 원. "10" → 100000, "2.5" → 25000 */
export function parseMan(value: string): number {
  const n = parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10000) : 0;
}

export function today(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-14", "10:03" → "2026년 10월 14일 (수) 오전 10:03" */
export function fullWhen(date: string, clock?: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y) return "";
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  let s = `${y}년 ${m}월 ${d}일 (${weekday})`;
  if (clock) {
    const [h, min] = clock.split(":").map(Number);
    const ampm = h < 12 ? "오전" : "오후";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    s += ` ${ampm} ${h12}:${String(min).padStart(2, "0")}`;
  }
  return s;
}

/** "2026-10-14" → "2026.10.14" */
export const shortDate = (date: string) => date.replace(/-/g, ".");
