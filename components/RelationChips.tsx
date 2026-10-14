"use client";

import { useState, type KeyboardEvent } from "react";

interface Props {
  relations: string[];
  value: string;
  onChange: (relation: string) => void;
  onAdd: (relation: string) => void;
  onRemove: (relation: string) => void;
}

/** 관계 버튼 줄. "+ 추가"로 새 관계를 만들고, 버튼 위 ×로 뺀다. */
export default function RelationChips({ relations, value, onChange, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const name = draft.trim();
    if (name) {
      onAdd(name);
      onChange(name);
    }
    setDraft("");
    setAdding(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setDraft("");
      setAdding(false);
    }
  }

  return (
    <div className="chips" role="radiogroup" aria-label="관계">
      {relations.map((r) => (
        <span key={r} className={`chip${value === r ? " on" : ""}`}>
          <button type="button" role="radio" aria-checked={value === r} onClick={() => onChange(r)}>
            {r}
          </button>
          {relations.length > 1 && (
            <button
              type="button"
              className="chip-x"
              aria-label={`${r} 버튼 빼기`}
              onClick={() => {
                onRemove(r);
                if (value === r) onChange(relations.find((x) => x !== r) ?? "");
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {adding ? (
        <input
          className="chip-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          placeholder="예: 동창"
          maxLength={10}
          autoFocus
        />
      ) : (
        <button type="button" className="chip add" onClick={() => setAdding(true)}>
          + 추가
        </button>
      )}
    </div>
  );
}
