"use client";

import { useRef, useState, type DragEvent } from "react";
import { typeInfo } from "@/lib/events";
import { money, shortDate } from "@/lib/format";
import { fileToCover } from "@/lib/image";
import type { Gift, LedgerEvent } from "@/lib/ledger";

interface Props {
  events: LedgerEvent[];
  gifts: Gift[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onCover: (id: string, cover: string) => void;
  toast: (text: string) => void;
}

/** 행사 카드 줄. 카드에 사진을 끌어다 놓으면 대표 사진이 된다. */
export default function EventCards({ events, gifts, currentId, onSelect, onNew, onCover, toast }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * 268, behavior: "smooth" });

  return (
    <div className="cards">
      <div className="cards-track" ref={track}>
        {events.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            gifts={gifts.filter((g) => g.eventId === e.id)}
            state={currentId === null ? "all" : currentId === e.id ? "on" : "off"}
            onSelect={() => onSelect(e.id)}
            onCover={(c) => onCover(e.id, c)}
            toast={toast}
          />
        ))}
        <button type="button" className="card new-card" onClick={onNew}>
          <span className="plus" aria-hidden="true">
            +
          </span>
          <span>새 행사</span>
        </button>
      </div>
      {events.length > 1 && (
        <>
          <button type="button" className="cards-arrow prev" onClick={() => scroll(-1)} aria-label="이전">
            ‹
          </button>
          <button type="button" className="cards-arrow next" onClick={() => scroll(1)} aria-label="다음">
            ›
          </button>
        </>
      )}
    </div>
  );
}

interface CardProps {
  event: LedgerEvent;
  gifts: Gift[];
  state: "all" | "on" | "off";
  onSelect: () => void;
  onCover: (cover: string) => void;
  toast: (text: string) => void;
}

function EventCard({ event, gifts, state, onSelect, onCover, toast }: CardProps) {
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const info = typeInfo(event.type);
  const total = gifts.reduce((s, g) => s + g.amount, 0);

  async function pick(file?: File) {
    if (!file) return;
    try {
      onCover(await fileToCover(file));
      toast("대표 사진을 바꿨어요.");
    } catch (e) {
      toast((e as Error).message || "사진을 넣지 못했어요.");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    pick(e.dataTransfer.files?.[0]);
  }

  return (
    <div
      className={`card event-card ${state}${over ? " over" : ""}`}
      style={{ background: info.cover }}
      role="button"
      tabIndex={0}
      aria-pressed={state === "on"}
      aria-label={`${event.title} 행사 보기`}
      onClick={onSelect}
      onKeyDown={(e) => {
        // 카드 안의 "사진" 버튼에서 누른 키는 그 버튼 몫이다
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {event.cover ? <img className="card-photo" src={event.cover} alt="" draggable={false} /> : <span className="card-empty">대표 사진 넣기</span>}
      <button
        type="button"
        className="card-pick"
        onClick={(e) => {
          e.stopPropagation();
          fileRef.current?.click();
        }}
      >
        사진
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="card-shade" aria-hidden="true" />
      <div className="card-text">
        <span className="card-type">{info.label}</span>
        <span className="card-title">{event.title}</span>
        <span className="card-sub">
          <span>{shortDate(event.date)}</span>
          {event.place && <span className="card-place">{event.place}</span>}
        </span>
        {gifts.length > 0 && <span className="card-sum num">{`${gifts.length}명 · ${money(total)}`}</span>}
      </div>
    </div>
  );
}
