"use client";

import { useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import { typeInfo } from "@/lib/events";
import { dotWhen, money } from "@/lib/format";
import { fileToCover } from "@/lib/image";
import type { Gift, LedgerEvent } from "@/lib/ledger";

interface Props {
  events: LedgerEvent[];
  gifts: Gift[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** 꾹 누르기·우클릭 메뉴 */
  onMenu: (id: string) => void;
  onAll: () => void;
  onNew: () => void;
  onCover: (id: string, cover: string) => void;
  toast: (text: string) => void;
}

/** 첫 화면: 내 행사 목록. 하나 누르면 그 행사로 들어가 바로 적는다. */
export default function Home({ events, gifts, onOpen, onEdit, onDelete, onMenu, onAll, onNew, onCover, toast }: Props) {
  // 날짜가 늦은 행사(앞으로 올 행사)가 위로
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const total = gifts.reduce((s, g) => s + g.amount, 0);

  return (
    <main className="wrap">
      <header className="home-head">
        <div>
          <h1>내 행사</h1>
          <p>{events.length ? "행사를 누르면 바로 적을 수 있어요" : "행사를 만들면 그 안에 받은 마음을 적을 수 있어요"}</p>
        </div>
        <button type="button" className="cta" onClick={onNew}>
          + 새 행사
        </button>
      </header>

      {sorted.length > 0 && (
        <ul className="events">
          {sorted.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              gifts={gifts.filter((g) => g.eventId === e.id)}
              onOpen={() => onOpen(e.id)}
              onEdit={() => onEdit(e.id)}
              onDelete={() => onDelete(e.id)}
              onMenu={() => onMenu(e.id)}
              onCover={(c) => onCover(e.id, c)}
              toast={toast}
            />
          ))}
        </ul>
      )}
      <button type="button" className="add-event" onClick={onNew}>
        + 새 행사 만들기
      </button>

      {events.length > 0 && (
        <button type="button" className="all-row" onClick={onAll}>
          <span>
            전체 기록{" "}
            <b className="num">
              {gifts.length}명 · {money(total)}
            </b>
          </span>
          <span className="all-more">모두 보기 ›</span>
        </button>
      )}
    </main>
  );
}

interface RowProps {
  event: LedgerEvent;
  gifts: Gift[];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMenu: () => void;
  onCover: (cover: string) => void;
  toast: (text: string) => void;
}

/** 손가락으로 0.5초 꾹 누르면 fn. 그 뒤 따라오는 클릭(들어가기)은 먹는다. 마우스는 우클릭으로 대신한다 */
function useLongPress(fn: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const stop = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse") return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        fn();
      }, 500);
    },
    onPointerMove(e: PointerEvent) {
      // 스크롤하려고 움직이면 꾹 누르기가 아니다
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onClickCapture(e: { preventDefault: () => void; stopPropagation: () => void }) {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu(e: { preventDefault: () => void }) {
      e.preventDefault();
      // 안드로이드는 꾹 누르면 contextmenu 도 온다 — 타이머가 이미 열었으면 또 열지 않는다
      if (!fired.current) fn();
    },
  };
}

/** 행사 한 줄. 누르면 들어가고, 아래 수정·삭제는 늘 보인다. 사진을 끌어다 놓으면 대표 사진이 된다 */
function EventRow({ event, gifts, onOpen, onEdit, onDelete, onMenu, onCover, toast }: RowProps) {
  const [over, setOver] = useState(false);
  const press = useLongPress(onMenu);
  const info = typeInfo(event.type);
  const total = gifts.reduce((s, g) => s + g.amount, 0);

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      onCover(await fileToCover(file));
      toast("대표 사진을 바꿨어요.");
    } catch (err) {
      toast((err as Error).message || "사진을 넣지 못했어요.");
    }
  }

  return (
    <li
      className={`event-row${over ? " over" : ""}`}
      style={{ "--accent": info.accent, "--cover": info.cover } as CSSProperties}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      {...press}
    >
      <button type="button" className="event-open" onClick={onOpen}>
        <span className="thumb">{event.cover && <img src={event.cover} alt="" draggable={false} />}</span>
        <span className="event-body">
          <span className="type-dot">{info.label}</span>
          <span className="event-title">{event.title}</span>
          <span className="event-when">{[dotWhen(event.date, event.time), event.place].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="event-stat num">
          <b>{money(total)}</b>
          <span>{gifts.length}명</span>
        </span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="event-actions">
        <button type="button" onClick={onEdit} aria-label={`${event.title} 수정`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
          </svg>
          수정
        </button>
        <button type="button" className="danger" onClick={onDelete} aria-label={`${event.title} 삭제`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
          </svg>
          삭제
        </button>
      </div>
    </li>
  );
}
