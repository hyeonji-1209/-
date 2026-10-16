"use client";

import { useState, type CSSProperties, type DragEvent } from "react";
import { typeInfo } from "@/lib/events";
import { dotWhen, money } from "@/lib/format";
import { fileToCover } from "@/lib/image";
import type { Gift, LedgerEvent } from "@/lib/ledger";

interface Props {
  events: LedgerEvent[];
  gifts: Gift[];
  onOpen: (id: string) => void;
  onAll: () => void;
  onNew: () => void;
  onCover: (id: string, cover: string) => void;
  toast: (text: string) => void;
}

/** 첫 화면: 내 행사 목록. 하나 누르면 그 행사로 들어가 바로 적는다. */
export default function Home({ events, gifts, onOpen, onAll, onNew, onCover, toast }: Props) {
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
  onCover: (cover: string) => void;
  toast: (text: string) => void;
}

/** 행사 한 줄. 사진을 끌어다 놓으면 대표 사진이 된다 (사진 고르기는 행사 정보 수정에서) */
function EventRow({ event, gifts, onOpen, onCover, toast }: RowProps) {
  const [over, setOver] = useState(false);
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
    <li>
      <button
        type="button"
        className={`event-row${over ? " over" : ""}`}
        style={{ "--accent": info.accent, "--cover": info.cover } as CSSProperties}
        onClick={onOpen}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
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
    </li>
  );
}
