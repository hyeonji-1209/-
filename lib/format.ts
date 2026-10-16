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

/** 숫자만 쳐도 "2026.11.07" 꼴로 점을 찍어 준다. 붙여넣은 "2026-11-07"도 받는다 */
export function maskDate(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

/** "2026.11.07" → "2026-11-07". 날짜가 아니면 null */
export function parseDate(masked: string): string | null {
  const d = masked.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
  const dt = new Date(y, m - 1, day);
  if (y < 1900 || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day) return null;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** "2026-11-07" → "2026.11.07" (입력칸 표시용) */
export const dotDate = (iso: string) => iso.replace(/-/g, ".");

/** "13:30" → "오후 1:30" */
export function clockLabel(clock: string): string {
  const [h, min] = clock.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? "오전" : "오후"} ${h12}:${String(min).padStart(2, "0")}`;
}

/** 행사 시간 고르기 목록: 30분 간격 */
export const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) for (const m of ["00", "30"]) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${m}`);
