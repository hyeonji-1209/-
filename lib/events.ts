export type EventType =
  | "wedding"
  | "first-birthday"
  | "birthday"
  | "sixtieth"
  | "funeral"
  | "housewarming"
  | "school"
  | "other";

export interface EventTypeInfo {
  type: EventType;
  label: string;
  /** 행사 이름 예시 */
  titleHint: string;
  /** 행사 종류 글자색 (상단 작은 라벨에만 쓴다) */
  accent: string;
  /** 대표 사진이 없을 때 카드 바탕색 */
  cover: string;
}

export const EVENT_TYPES: EventTypeInfo[] = [
  { type: "wedding", label: "결혼식", titleHint: "예: 우리 결혼식", accent: "#3b6fd8", cover: "#e9eef8" },
  { type: "first-birthday", label: "돌잔치", titleHint: "예: 첫째 돌잔치", accent: "#0e9f8a", cover: "#e4f3f0" },
  { type: "birthday", label: "생일", titleHint: "예: 엄마 생신", accent: "#7c5cd6", cover: "#eeeaf8" },
  { type: "sixtieth", label: "환갑·칠순", titleHint: "예: 아빠 칠순", accent: "#b8562c", cover: "#f6ebe4" },
  { type: "funeral", label: "장례식", titleHint: "예: 할머니 장례식", accent: "#71717a", cover: "#e8ebef" },
  { type: "housewarming", label: "집들이·개업", titleHint: "예: 신혼집 집들이", accent: "#2f9e6b", cover: "#e7f2ec" },
  { type: "school", label: "입학·졸업", titleHint: "예: 첫째 초등학교 입학", accent: "#1f8fb5", cover: "#e4f1f6" },
  { type: "other", label: "기타", titleHint: "예: 승진 축하", accent: "#52525b", cover: "#f1f3f5" },
];

export function typeInfo(type: EventType): EventTypeInfo {
  return EVENT_TYPES.find((t) => t.type === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

/** 받은 분과의 관계 */
export const DEFAULT_RELATIONS = ["친척", "친구", "직장", "이웃", "지인"];
