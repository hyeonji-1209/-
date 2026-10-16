"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { typeInfo } from "@/lib/events";
import { fullWhen, money, parseMan } from "@/lib/format";
import type { Gift, Ledger, LedgerEvent } from "@/lib/ledger";
import { downloadBlob, makeXlsx, type Cell } from "@/lib/xlsx";
import EditSheet from "./EditSheet";
import RelationChips from "./RelationChips";
import SearchBox from "./SearchBox";

interface Props {
  ledger: Ledger;
  /** 없으면 전체 기록 */
  event: LedgerEvent | null;
  /** 행사를 막 만들었을 때 이름 칸에 바로 커서를 둔다 */
  focusName?: boolean;
  onEdit: () => void;
  toast: (text: string, action?: { label: string; run: () => void }) => void;
}

export default function LedgerPanel({ ledger, event, focusName, onEdit, toast }: Props) {
  const { events, gifts } = ledger.data;
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Gift | null>(null);
  /** 최근순 | 관계별 — 한 번 고르면 기억한다 */
  const [mode, setMode] = useState<"recent" | "relation">(() => {
    try {
      return localStorage.getItem("maeum-ledger.listMode") === "recent" ? "recent" : "relation";
    } catch {
      return "relation";
    }
  });
  function pickMode(m: "recent" | "relation") {
    setMode(m);
    try {
      localStorage.setItem("maeum-ledger.listMode", m);
    } catch {
      /* ignore */
    }
  }
  const { relations } = ledger.data;
  /** 관계 버튼 순서대로, 목록에 없는 관계는 뒤에 */
  const relOrder = (r: string) => {
    const i = relations.indexOf(r);
    return i === -1 ? relations.length : i;
  };
  /** 관계 → 그 관계의 기록(적은 순서) */
  function groupByRelation(list: Gift[]): { relation: string; items: Gift[]; total: number }[] {
    const map = new Map<string, Gift[]>();
    for (const g of [...list].sort((a, b) => a.createdAt - b.createdAt)) map.set(g.relation, [...(map.get(g.relation) ?? []), g]);
    return [...map.entries()]
      .sort((a, b) => relOrder(a[0]) - relOrder(b[0]) || a[0].localeCompare(b[0], "ko"))
      .map(([relation, items]) => ({ relation, items, total: items.reduce((s, g) => s + g.amount, 0) }));
  }
  const eventOf = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const scope = useMemo(
    () => (event ? gifts.filter((g) => g.eventId === event.id) : gifts).slice().sort((a, b) => b.createdAt - a.createdAt),
    [gifts, event],
  );
  const term = q.trim();
  const rows = term ? scope.filter((g) => g.name.includes(term) || (!event && eventOf.get(g.eventId)?.title.includes(term))) : scope;
  const total = scope.reduce((s, g) => s + g.amount, 0);

  /** 관계별로 묶고, 관계마다 소계 줄을 넣는다. 금액은 숫자 칸이라 엑셀에서 콤마가 붙는다 */
  function downloadExcel() {
    const title = event ? event.title : "전체 기록";
    const extra = event ? [] : ["", ""];
    const head: Cell[] = (event ? ["이름", "관계", "금액(원)"] : ["이름", "관계", "금액(원)", "행사", "날짜"]).map((v) => ({ v, bold: true }));
    const body: Cell[][] = [];
    for (const grp of groupByRelation(scope)) {
      for (const g of grp.items) {
        const e = eventOf.get(g.eventId);
        body.push(event ? [g.name, g.relation, g.amount] : [g.name, g.relation, g.amount, e?.title ?? "", e?.date ?? ""]);
      }
      body.push([{ v: `${grp.relation} 소계`, bold: true }, { v: `${grp.items.length}명`, bold: true }, { v: grp.total, bold: true }, ...extra], []);
    }
    const sum: Cell[] = [{ v: "합계", bold: true }, { v: `${scope.length}명`, bold: true }, { v: total, bold: true }, ...extra];
    const info: Cell[][] = event ? [[{ v: event.title, bold: true }, [fullWhen(event.date, event.time), event.place].filter(Boolean).join(" · ")], []] : [];
    downloadBlob(`마음장부_${title}.xlsx`, makeXlsx(title, [...info, head, ...body, sum], event ? [16, 12, 14] : [16, 12, 14, 24, 12]));
    toast("엑셀 파일로 내려받았어요.");
  }

  function renderRow(g: Gift, inGroup = false) {
    return (
      <li key={g.id} className="row">
        <button type="button" className="row-name" onClick={() => setEditing(g)} title="고치기">
          {g.name}
        </button>
        {/* 관계별로 묶여 있고 행사 안이면 관계는 머리글에 있으니 생략 */}
        <span className="row-rel">{event ? (inGroup ? "" : g.relation) : `${inGroup ? "" : g.relation + " · "}${eventOf.get(g.eventId)?.title ?? "삭제된 행사"}`}</span>
        <span className="row-amt num">{money(g.amount)}</span>
        <button type="button" className="row-edit" onClick={() => setEditing(g)}>
          수정
        </button>
        <button
          type="button"
          className="row-del"
          aria-label={`${g.name} 기록 삭제`}
          onClick={() => {
            ledger.removeGift(g.id);
            toast(`${g.name} 기록을 지웠어요.`, { label: "되돌리기", run: () => ledger.restoreGift(g) });
          }}
        >
          ×
        </button>
      </li>
    );
  }

  return (
    <section className="panel">
      <div className="panel-inner">
        <header className="panel-head">
          <div className="panel-title">
            <div className="eyebrow">
              <span style={{ color: event ? typeInfo(event.type).accent : undefined }}>{event ? typeInfo(event.type).label : "모든 행사"}</span>
              {event && (
                <button type="button" className="link-muted" onClick={onEdit}>
                  행사 수정
                </button>
              )}
            </div>
            <h1>{event ? event.title : "전체 기록"}</h1>
            <span className="panel-meta">
              {event ? [fullWhen(event.date, event.time), event.place].filter(Boolean).join(" · ") : `행사 ${events.length}개`}
            </span>
          </div>
          <div className="panel-total">
            <span className="num">{scope.length}명 · 합계</span>
            <strong className="num">{money(total)}</strong>
          </div>
        </header>

        <div className="ledger">
          {event && <QuickAdd key={event.id} ledger={ledger} event={event} autoFocus={focusName} toast={toast} />}

          <div className="list-bar">
            <span className="num">방명록 {rows.length}</span>
            {scope.length > 0 && (
              <div className="list-tools">
                <div className="seg" role="radiogroup" aria-label="정렬">
                  <button type="button" role="radio" aria-checked={mode === "relation"} onClick={() => pickMode("relation")}>
                    관계별
                  </button>
                  <button type="button" role="radio" aria-checked={mode === "recent"} onClick={() => pickMode("recent")}>
                    최근순
                  </button>
                </div>
                <button type="button" className="link-muted" onClick={downloadExcel}>
                  엑셀로 다운받기
                </button>
                <SearchBox value={q} onChange={setQ} placeholder={event ? "이름 검색" : "이름·행사 검색"} />
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="list-empty">
              {term
                ? "일치하는 이름이 없어요"
                : events.length === 0
                  ? "위에서 새 행사를 만들면 바로 적을 수 있어요"
                  : event
                    ? "첫 번째 마음을 적어보세요"
                    : "아직 기록이 없어요"}
            </p>
          ) : mode === "relation" ? (
            <ul className="rows">
              {groupByRelation(rows).map((grp) => (
                <li key={grp.relation} className="group">
                  <div className="group-head">
                    <span>{grp.relation}</span>
                    <span className="num">
                      {grp.items.length}명 · {money(grp.total)}
                    </span>
                  </div>
                  <ul>
                    {grp.items.map((g) => renderRow(g, true))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="rows">
              {rows.map((g) => renderRow(g))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <EditSheet
          ledger={ledger}
          gift={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            ledger.updateGift(editing.id, patch);
            setEditing(null);
            toast("고쳤어요.");
          }}
        />
      )}
    </section>
  );
}

interface QuickProps {
  ledger: Ledger;
  event: LedgerEvent;
  autoFocus?: boolean;
  toast: Props["toast"];
}

/** 이름 · 금액을 넣고 관계 버튼을 고른 뒤 Enter 또는 → 로 바로 저장 */
function QuickAdd({ ledger, event, autoFocus, toast }: QuickProps) {
  const { relations, lastRelation } = ledger.data;
  const [name, setName] = useState("");
  // 한 번 고른 관계는 바꾸기 전까지 유지된다 (앱을 다시 열어도)
  const [relation, setRelation] = useState(lastRelation && relations.includes(lastRelation) ? lastRelation : (relations[0] ?? ""));
  const [amount, setAmount] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const won = parseMan(amount);
  const ready = name.trim().length > 0 && won > 0;

  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);

  function save() {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    if (!won) {
      amountRef.current?.focus();
      return;
    }
    const g = ledger.addGift(event.id, { name: name.trim(), relation, amount: won });
    toast(`${g.name} · ${g.relation} ${money(won)} 저장`, { label: "되돌리기", run: () => ledger.removeGift(g.id) });
    setName("");
    setAmount("");
    nameRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (e.currentTarget === nameRef.current && !won) amountRef.current?.focus();
      else save();
    }
  }

  return (
    <div className="quick">
      <input
        ref={nameRef}
        id="quick-name"
        className="quick-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKey}
        placeholder="이름을 입력하세요"
        enterKeyHint="next"
        autoComplete="off"
      />
      <span className="quick-amount">
        <input
          ref={amountRef}
          id="quick-amount"
          className="num"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={onKey}
          placeholder="0"
          enterKeyHint="done"
          aria-label="금액 (만원)"
        />
        <span>만원</span>
      </span>
      <button type="button" className={`quick-go${ready ? " ready" : ""}`} onClick={save} aria-label="추가">
        →
      </button>
      <RelationChips
        relations={relations}
        value={relation}
        onChange={setRelation}
        onAdd={ledger.addRelation}
        onRemove={(r) => {
          ledger.removeRelation(r);
          toast(`'${r}' 버튼을 뺐어요.`, { label: "되돌리기", run: () => ledger.addRelation(r) });
        }}
      />
    </div>
  );
}
