"use client";

import { dotWhen } from "@/lib/format";
import type { LedgerEvent } from "@/lib/ledger";
import Sheet from "./Sheet";

/** 행사를 꾹 눌렀을 때(우클릭) 뜨는 메뉴. 버튼을 크게, 하는 일을 글로 적는다 */
export function EventMenu({ event, onOpen, onEdit, onDelete, onClose }: { event: LedgerEvent; onOpen: () => void; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  return (
    <Sheet title={event.title} onClose={onClose}>
      <p className="menu-sub">{dotWhen(event.date, event.time)}</p>
      <div className="menu">
        <button type="button" onClick={onOpen}>
          들어가서 적기
        </button>
        <button type="button" onClick={onEdit}>
          행사 정보 수정
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          행사 삭제
        </button>
      </div>
    </Sheet>
  );
}

/** 행사 삭제 확인. 함께 지워지는 기록 수를 분명히 알린다 */
export function DeleteConfirm({ event, giftCount, onConfirm, onClose }: { event: LedgerEvent; giftCount: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title="행사를 지울까요?" onClose={onClose}>
      <p className="confirm-text">
        <b>{event.title}</b>
        {giftCount > 0 ? (
          <>
            {" "}
            행사와 적어 둔 기록 <b className="num">{giftCount}건</b>이 모두 지워져요.
          </>
        ) : (
          " 행사를 지워요."
        )}
        <br />
        지운 바로 뒤에는 화면 아래 ‘되돌리기’로 살릴 수 있어요.
      </p>
      <div className="confirm-btns">
        <button type="button" className="btn ghost" onClick={onClose} autoFocus>
          취소
        </button>
        <button type="button" className="btn danger" onClick={onConfirm}>
          삭제
        </button>
      </div>
    </Sheet>
  );
}
