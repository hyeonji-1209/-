"use client";

import { useEffect, useState } from "react";
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
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const { events, gifts, currentEventId } = ledger.data;
  const current = events.find((e) => e.id === currentEventId) ?? null;

  useEffect(() => {
    if (ledger.migrated) toast.show(`이 기기에 있던 기록 ${ledger.migrated}건을 계정으로 옮겼어요.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.migrated]);

  if (!ledger.ready) return <div className="app" />;

  return (
    <div className="app">
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="brand">
            <img className="brand-mark" src="/brand.png" alt="" />
            마음장부
          </span>
          <button type="button" className={`pill${current ? "" : " active"}`} onClick={() => ledger.openEvent(null)}>
            전체 기록
          </button>
          <button type="button" className="pill solid" onClick={() => setModal("new")}>
            + 새 행사
          </button>
          {onSignOut && (
            <span className="who">
              {who && <span className="who-name">{who}님</span>}
              <button type="button" className="pill ghost" onClick={onSignOut} title={username ?? undefined}>
                로그아웃
              </button>
            </span>
          )}
        </div>
      </nav>

      {(ledger.saveFailed || ledger.loadFailed) && (
        <div className="save-error" role="alert">
          {!ledger.cloud
            ? "이 브라우저에 저장하지 못하고 있어요. 시크릿 모드라면 일반 창에서 열어 주세요."
            : ledger.saveFailed
              ? "아직 계정에 저장되지 않은 기록이 있어요. 인터넷이 연결되면 자동으로 저장돼요. 그 전엔 이 탭을 닫지 마세요."
              : "계정에서 기록을 불러오지 못했어요. 이 기기에 있던 사본을 보여 주고 있어요."}
        </div>
      )}

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">My Events</span>
          <h2>
            주고받은 마음을
            <br />
            <b>한곳에 모아두세요</b>
          </h2>
          <p>
            행사를 고르면 아래에서 바로
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

      <footer className="foot">
        {ledger.cloud ? `${who ?? "내"} 계정에 저장돼요` : "이 기기에만 저장돼요"} · 기록은 ‘엑셀로 다운받기’로 꺼낼 수 있어요
      </footer>

      {modal === "new" && (
        <EventModal
          onClose={() => setModal(null)}
          onSave={(details) => {
            const e = ledger.createEvent(details);
            setJustCreated(e.id);
            setModal(null);
          }}
        />
      )}
      {modal === "edit" && current && (
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
      )}
      {toast.node}
    </div>
  );
}
