"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { typeInfo } from "@/lib/events";
import { fullWhen, money, parseMan, relDay } from "@/lib/format";
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

const MODE_KEY = "maeum-ledger.listMode";

/** 행사 하나(또는 전체 기록) 화면: 머리글·합계 → 새로 적기 → 방명록 */
export default function LedgerPanel({ ledger, event, focusName, onEdit, toast }: Props) {
  const { events, gifts, relations } = ledger.data;
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Gift | null>(null);
  /** 방금 적은 기록 — 목록에서 살짝 칠해 둔다 */
  const [fresh, setFresh] = useState<string | null>(null);
  /** 최근순 | 관계별 — 한 번 고르면 기억한다 */
  const [mode, setMode] = useState<"recent" | "relation">(() => {
    try {
      return localStorage.getItem(MODE_KEY) === "recent" ? "recent" : "relation";
    } catch {
      return "relation";
    }
  });
  function pickMode(m: "recent" | "relation") {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }
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
  const info = event ? typeInfo(event.type) : null;

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
    const infoRows: Cell[][] = event ? [[{ v: event.title, bold: true }, [fullWhen(event.date, event.time), event.place].filter(Boolean).join(" · ")], []] : [];
    downloadBlob(`마음장부_${title}.xlsx`, makeXlsx(title, [...infoRows, head, ...body, sum], event ? [16, 12, 14] : [16, 12, 14, 24, 12]));
    toast("엑셀 파일로 내려받았어요.");
  }

  function remove(g: Gift) {
    ledger.removeGift(g.id);
    toast(`${g.name} 기록을 지웠어요.`, { label: "되돌리기", run: () => ledger.restoreGift(g) });
  }

  function renderRow(g: Gift) {
    const where = event ? null : (eventOf.get(g.eventId)?.title ?? "삭제된 행사");
    return (
      <tr key={g.id} className={g.id === fresh ? "fresh" : undefined} onClick={() => setEditing(g)}>
        <td className="g-name">
          <button type="button" onClick={(e) => (e.stopPropagation(), setEditing(g))}>
            {g.name}
          </button>
        </td>
        <td className="g-rel">{where ? `${g.relation} · ${where}` : g.relation}</td>
        <td className="g-amt num">{money(g.amount)}</td>
        <td className="g-act">
          <button type="button" className="g-edit" onClick={(e) => (e.stopPropagation(), setEditing(g))}>
            수정
          </button>
          <button type="button" className="g-del" aria-label={`${g.name} 기록 삭제`} onClick={(e) => (e.stopPropagation(), remove(g))}>
            ×
          </button>
        </td>
        <td className="g-day num">{relDay(g.createdAt)}</td>
      </tr>
    );
  }

  return (
    <main className="wrap">
      <header className="ev-head">
        <div className="ev-title">
          <div className="type-dot" style={info ? ({ "--accent": info.accent } as CSSProperties) : undefined}>
            {info ? info.label : "모든 행사"}
            {event && (
              <button type="button" className="link-quiet" onClick={onEdit}>
                행사 정보 수정
              </button>
            )}
          </div>
          <h1>{event ? event.title : "전체 기록"}</h1>
          <p className="meta">{event ? [fullWhen(event.date, event.time), event.place].filter(Boolean).join(" · ") : `행사 ${events.length}개`}</p>
        </div>
        <div className="ev-total num">
          <span>{scope.length}명 · 합계</span>
          <b>{money(total)}</b>
        </div>
      </header>

      {event && <QuickAdd ledger={ledger} event={event} autoFocus={focusName} toast={toast} onAdded={setFresh} />}

      <section className="list">
        <div className="list-bar">
          <span className="eyebrow num">방명록 {rows.length}명</span>
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
              <SearchBox value={q} onChange={setQ} placeholder={event ? "이름 검색" : "이름·행사 검색"} />
              <button type="button" className="link-quiet" onClick={downloadExcel}>
                엑셀로 다운받기
              </button>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="list-empty">{term ? "일치하는 이름이 없어요" : event ? "첫 번째 마음을 적어보세요" : "아직 기록이 없어요"}</p>
        ) : (
          <table className={`gifts${event ? "" : " all"}`}>
            <thead>
              <tr>
                <th>이름</th>
                <th>{event ? "관계" : "관계 · 행사"}</th>
                <th className="r">금액</th>
                <th>
                  <span className="sr-only">고치기</span>
                </th>
                <th className="g-day r">작성일자</th>
              </tr>
            </thead>
            <tbody>
              {mode === "relation"
                ? groupByRelation(rows).flatMap((grp) => [
                    <tr key={`grp-${grp.relation}`} className="grp">
                      <td colSpan={5}>
                        <span>{grp.relation}</span>
                        <em className="num">
                          {grp.items.length}명 · {money(grp.total)}
                        </em>
                      </td>
                    </tr>,
                    ...grp.items.map(renderRow),
                  ])
                : rows.map(renderRow)}
            </tbody>
          </table>
        )}
      </section>

      <p className="page-foot">
        이름을 누르면 고칠 수 있어요 · {ledger.cloud ? "기록은 계정에 저장돼요" : "기록은 이 기기에만 저장돼요"} · 엑셀로 꺼낼 수 있어요
      </p>

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
          onDelete={() => {
            remove(editing);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

interface QuickProps {
  ledger: Ledger;
  event: LedgerEvent;
  autoFocus?: boolean;
  toast: Props["toast"];
  onAdded: (id: string) => void;
}

const NEW_REL = "\u0000new";

/** 이름 · 금액 · 관계를 고르고 Enter(또는 저장)로 바로 적는다. 폰에선 관계를 드롭다운으로 고른다 */
function QuickAdd({ ledger, event, autoFocus, toast, onAdded }: QuickProps) {
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
    onAdded(g.id);
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

  function pickSelect(v: string) {
    if (v !== NEW_REL) {
      setRelation(v);
      return;
    }
    const r = window.prompt("새 관계 이름 (예: 동창)")?.trim().slice(0, 10);
    if (!r) return;
    ledger.addRelation(r);
    setRelation(r);
  }

  return (
    <>
      <div className="composer">
        <input
          ref={nameRef}
          id="quick-name"
          className="c-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKey}
          placeholder="이름을 적고 Enter"
          enterKeyHint="next"
          autoComplete="off"
          aria-label="이름"
        />
        <label className="c-amt">
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
        </label>
        <label className="c-rel">
          <span>관계</span>
          <select value={relation} onChange={(e) => pickSelect(e.target.value)}>
            {!relations.includes(relation) && <option value={relation}>{relation}</option>}
            {relations.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value={NEW_REL}>+ 새 관계…</option>
          </select>
        </label>
        <button type="button" className={`c-go${ready ? " ready" : ""}`} onClick={save} aria-label="저장">
          <span className="c-go-arrow" aria-hidden="true">
            →
          </span>
          <span className="c-go-text">저장</span>
        </button>
      </div>
      <div className="c-chips">
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
    </>
  );
}
