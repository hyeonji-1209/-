"use client";

import { useState } from "react";
import { parseMan } from "@/lib/format";
import type { Gift, GiftDetails, Ledger } from "@/lib/ledger";
import RelationChips from "./RelationChips";
import Sheet from "./Sheet";

interface Props {
  ledger: Ledger;
  gift: Gift;
  onClose: () => void;
  onSave: (patch: GiftDetails) => void;
  onDelete: () => void;
}

export default function EditSheet({ ledger, gift, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(gift.name);
  const [relation, setRelation] = useState(gift.relation);
  const [amount, setAmount] = useState(String(gift.amount / 10000));
  const won = parseMan(amount);
  const ready = name.trim().length > 0 && won > 0;
  // 지금 목록에 없는 관계(지운 버튼)도 고를 수 있게 같이 보여준다
  const relations = ledger.data.relations.includes(relation) ? ledger.data.relations : [relation, ...ledger.data.relations];

  return (
    <Sheet title="기록 고치기" onClose={onClose}>
      <form
        className="event-form"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSave({ name: name.trim(), relation, amount: won });
        }}
      >
        <div className="field-row">
          <label className="field">
            <span>이름</span>
            <input id="edit-name" className="line-input big" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>금액 (만원)</span>
            <input id="edit-amount" className="line-input big num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span>관계</span>
          <RelationChips relations={relations} value={relation} onChange={setRelation} onAdd={ledger.addRelation} onRemove={ledger.removeRelation} />
        </div>
        <div className="event-form-foot">
          <button type="button" className="link-danger" onClick={onDelete}>
            기록 삭제
          </button>
          <button type="submit" className="btn primary" disabled={!ready}>
            저장
          </button>
        </div>
      </form>
    </Sheet>
  );
}
