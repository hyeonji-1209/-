"use client";

import { useEffect, useState } from "react";
import { useKeyboardOpen } from "@/lib/keyboard";
import { useLedger } from "@/lib/ledger";
import EventCards from "./EventCards";
import EventModal from "./EventModal";
import LedgerPanel from "./LedgerPanel";
import { useToast } from "./Toast";

type Modal = null | "new" | "edit";

interface Props {
  /** 로그인한 사람의 아이덴티티 ID. 클라우드 미설정이면 null */
  user: string | null;
  username: string | null;
  nickname: string | null;
  onSignOut?: () => void;
}

export default function App({ user, username, nickname, onSignOut }: Props) {
  const who = nickname || username;
  const ledger = useLedger(user);
  const toast = useToast();
  const [modal, setModal] = useState<Modal>(null);
  const keyboard = useKeyboardOpen();
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const { events, gifts, currentEventId } = ledger.data;
  const current = events.find((e) => e.id === currentEventId) ?? null;

  useEffect(() => {
    if (ledger.migrated) toast.show(`이 기기에 있던 기록 ${ledger.migrated}건을 계정으로 옮겼어요.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.migrated]);

  /** 밀린 변경을 먼저 보내 보고, 그래도 남으면 물어본 뒤 이 기기의 사본까지 지우고 나간다 */
  async function signOut() {
    if (!onSignOut) return;
    const sent = await ledger.flushNow();
    if (!sent && !window.confirm("아직 계정에 저장되지 않은 기록이 있어요. 지금 로그아웃하면 그 기록은 사라져요. 그래도 로그아웃할까요?")) return;
    ledger.clearLocal();
    onSignOut();
  }

  if (!ledger.ready) return <div className="app" />;

  return (
    <div className="app" >
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="brand">
            <img className="brand-mark" src="/brand.png" alt="" />
            <span className="brand-name">마음장부</span>
          </span>
          {/* 폰에서는 이 둘이 아래 고정 바로 내려간다 (.topnav .pill.nav-main 숨김) */}
          <button type="button" className={`pill nav-main${current ? "" : " active"}`} onClick={() => ledger.openEvent(null)} aria-label="전체 기록">
            <ListIcon />
            <span className="pill-text">전체 기록</span>
          </button>
          <button type="button" className="pill solid nav-main" onClick={() => setModal("new")} aria-label="새 행사">
            <PlusIcon />
            <span className="pill-text">+ 새 행사</span>
          </button>
          {onSignOut && (
            <span className="who">
              {who && <span className="who-name">{who}님</span>}
              <button type="button" className="pill ghost" onClick={signOut} title={username ?? undefined} aria-label="로그아웃">
                <ExitIcon />
                <span className="pill-text">로그아웃</span>
              </button>
            </span>
          )}
        </div>
      </nav>

      {
        ledger.expired && onSignOut ? (
          <div className="save-error" role="alert">
            로그인이 만료됐어요. 다시 로그인하면 밀린 기록도 저장돼요.{" "}
            {/* 사본·대기열은 지우지 않는다 — 같은 계정으로 다시 들어오면 이어서 보낸다 */}
            <button type="button" className="link" onClick={onSignOut}>
              다시 로그인
            </button>
          </div>
        ) : (ledger.saveFailed || ledger.loadFailed) && (
          <div className="save-error" role="alert">
            {!ledger.cloud
              ? "이 브라우저에 저장하지 못하고 있어요. 시크릿 모드라면 일반 창에서 열어 주세요."
              : ledger.saveFailed
                ? "아직 계정에 저장되지 않은 기록이 있어요. 인터넷이 연결되면 자동으로 저장돼요. 그 전엔 이 탭을 닫지 마세요."
                : "계정에서 기록을 불러오지 못했어요. 이 기기에 있던 사본을 보여 주고 있어요."}
          </div>
        )
      }

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">My Events</span>
          <h2>
            주고받은 마음을
            <br />
            <b>한곳에 모아두세요</b>
          </h2>
          <p>
            행사를 고르면 아래에서 바로{" "}
            <br />
            방명록을 적을 수 있어요.
          </p>
          <div>
            <button type="button" className="pill outline" onClick={() => setModal("new")}>
              새 행사 만들기 →
            </button>
          </div>
        </div>
        <EventCards
          events={events}
          gifts={gifts}
          currentId={current?.id ?? null}
          onSelect={(id) => {
            setJustCreated(null);
            ledger.openEvent(id);
          }}
          onNew={() => setModal("new")}
          onCover={(id, cover) => ledger.updateEvent(id, { cover })}
          toast={toast.show}
        />
      </section>

      <LedgerPanel ledger={ledger} event={current} focusName={!!current && justCreated === current.id} onEdit={() => setModal("edit")} toast={toast.show} />

      {/* 폰: 아래 고정 바. 키패드가 올라오면 숨긴다 */}
      <nav className={`bottombar${keyboard ? " hidden" : ""}`} aria-label="주요 메뉴">
        <button type="button" className={current ? "" : "active"} onClick={() => ledger.openEvent(null)}>
          <ListIcon />
          <span>전체 기록</span>
        </button>
        <button type="button" className="solid" onClick={() => setModal("new")}>
          <PlusIcon />
          <span>새 행사</span>
        </button>
      </nav>

      <footer className="foot">
        {ledger.cloud ? `${who ?? "내"} 계정에 저장돼요` : "이 기기에만 저장돼요"} · 기록은 ‘엑셀로 다운받기’로 꺼낼 수 있어요
      </footer>

      {
        modal === "new" && (
          <EventModal
            onClose={() => setModal(null)}
            onSave={(details) => {
              const e = ledger.createEvent(details);
              setJustCreated(e.id);
              setModal(null);
            }}
          />
        )
      }
      {
        modal === "edit" && current && (
          <EventModal
            event={current}
            giftCount={gifts.filter((g) => g.eventId === current.id).length}
            onClose={() => setModal(null)}
            onSave={(details) => {
              ledger.updateEvent(current.id, details);
              setModal(null);
              toast.show("행사 정보를 고쳤어요.");
            }}
            onDelete={() => {
              ledger.deleteEvent(current.id);
              setModal(null);
              toast.show(`${current.title} 행사를 지웠어요.`);
            }}
          />
        )
      }
      {toast.node}
    </div >
  );
}

function ListIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ExitIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10" />
    </svg>
  );
}
