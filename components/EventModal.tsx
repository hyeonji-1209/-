"use client";

import { useRef, useState, type CSSProperties } from "react";
import { EVENT_TYPES, typeInfo, type EventType } from "@/lib/events";
import { TIME_OPTIONS, clockLabel, dotDate, maskDate, parseDate, today } from "@/lib/format";
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
  const [date, setDate] = useState(event ? dotDate(event.date) : "");
  const [time, setTime] = useState(event?.time ?? "");
  const [place, setPlace] = useState(event?.place ?? "");
  const [cover, setCover] = useState(event?.cover);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = !!event;
  const iso = date ? parseDate(date) : "";
  const dateBad = date.length > 0 && iso === null;
  const ready = title.trim().length > 0 && !dateBad;

  function submit() {
    if (!ready) return;
    onSave({ type, title: title.trim(), date: iso || today(), time, place: place.trim(), cover });
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
            <span>날짜 {dateBad && <em className="field-err">날짜를 다시 확인해 주세요</em>}</span>
            <span className="with-btn">
              <input
                id="event-date"
                className="line-input num"
                inputMode="numeric"
                placeholder="2026.11.07"
                value={date}
                onChange={(e) => setDate(maskDate(e.target.value))}
                aria-invalid={dateBad || undefined}
              />
              <button type="button" className="mini" onClick={() => setDate(dotDate(today()))}>
                오늘
              </button>
            </span>
          </label>
          <label className="field">
            <span>시간 (선택)</span>
            <select id="event-time" className="line-input" value={time} onChange={(e) => setTime(e.target.value)}>
              <option value="">시간 없음</option>
              {time && !TIME_OPTIONS.includes(time) && <option value={time}>{clockLabel(time)}</option>}
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {clockLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>장소</span>
          <input id="event-place" className="line-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: 서울 강남" />
        </label>

        <div className="field">
          <span>대표 사진 (선택)</span>
          <span className="cover-pick">
            <span className="thumb" style={{ "--cover": typeInfo(type).cover } as CSSProperties}>
              {cover && <img src={cover} alt="" />}
            </span>
            <button type="button" className="mini" onClick={() => fileRef.current?.click()}>
              {cover ? "다른 사진" : "사진 고르기"}
            </button>
            {cover && (
              <button type="button" className="mini" onClick={() => setCover(undefined)}>
                빼기
              </button>
            )}
          </span>
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
            <span />
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
