"use client";

import { useRef, useState } from "react";
import { EVENT_TYPES, typeInfo, type EventType } from "@/lib/events";
import { fileToCover } from "@/lib/image";
import type { EventDetails, LedgerEvent } from "@/lib/ledger";
import Sheet from "./Sheet";

interface Props {
  /** 고칠 행사. 없으면 새 행사 */
  event?: LedgerEvent;
  giftCount?: number;
  onClose: () => void;
  onSave: (details: EventDetails) => void;
  onDelete?: () => void;
}

export default function EventModal({ event, giftCount = 0, onClose, onSave, onDelete }: Props) {
  const [type, setType] = useState<EventType>(event?.type ?? "wedding");
  const [title, setTitle] = useState(event?.title ?? "");
  const [when, setWhen] = useState(event ? `${event.date}${event.time ? `T${event.time}` : ""}` : "");
  const [place, setPlace] = useState(event?.place ?? "");
  const [cover, setCover] = useState(event?.cover);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = !!event;
  const ready = title.trim().length > 0;

  function submit() {
    if (!ready) return;
    const [date, time] = when.split("T");
    onSave({ type, title: title.trim(), date, time: time ?? "", place: place.trim(), cover });
  }

  return (
    <Sheet title={editing ? "행사 수정" : "새 행사"} onClose={onClose}>
      <form
        className="event-form"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="type-tabs" role="radiogroup" aria-label="행사 종류">
          {EVENT_TYPES.map((t) => (
            <button key={t.type} type="button" role="radio" aria-checked={type === t.type} onClick={() => setType(t.type)}>
              {t.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span>행사 이름</span>
          <input id="event-title" className="line-input big" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={typeInfo(type).titleHint} autoFocus />
        </label>

        <div className="field-row">
          <label className="field">
            <span>일시</span>
            <input id="event-when" className="line-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="field">
            <span>장소</span>
            <input id="event-place" className="line-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: 일산" />
          </label>
        </div>

        <div className="event-form-foot">
          {editing && onDelete ? (
            <button
              type="button"
              className={`link-danger${confirmDelete ? " confirm" : ""}`}
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            >
              {confirmDelete ? (giftCount ? `기록 ${giftCount}건까지 모두 삭제` : "정말 삭제") : "행사 삭제"}
            </button>
          ) : (
            <span className="hint">
              대표 사진은 카드에 끌어다 놓거나{" "}
              <button type="button" className="link" onClick={() => fileRef.current?.click()}>
                {cover ? "다시 고르기" : "여기서 고르기"}
              </button>
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setCover(await fileToCover(f).catch(() => cover));
            }}
          />
          <button type="submit" className="btn primary" disabled={!ready}>
            {editing ? "저장" : "만들기"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
