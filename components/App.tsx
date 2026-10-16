"use client";

import { useEffect, useRef, useState } from "react";
import { useLedger } from "@/lib/ledger";
import EventModal from "./EventModal";
import Home from "./Home";
import LedgerPanel from "./LedgerPanel";
import { useToast } from "./Toast";

type Modal = null | "new" | "edit";

/** 첫 화면 · 행사 하나 · 전체 기록. 주소(?e=행사ID, ?v=all)에도 두어 폰의 뒤로 가기·새로고침이 자연스럽다 */
type View = { page: "home" } | { page: "event"; id: string } | { page: "all" };
const HOME: View = { page: "home" };

function readView(): View {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("e");
  if (id) return { page: "event", id };
  return q.get("v") === "all" ? { page: "all" } : HOME;
}
const urlOf = (v: View) => (v.page === "event" ? `?e=${encodeURIComponent(v.id)}` : v.page === "all" ? "?v=all" : window.location.pathname);

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
  const [view, setView] = useState<View>(readView);
  /** 이 앱 안에서 들어온 화면이면 ‹ 는 브라우저 뒤로 가기와 같다 */
  const pushed = useRef(false);

  const { events, gifts } = ledger.data;
  const current = view.page === "event" ? (events.find((e) => e.id === view.id) ?? null) : null;

  useEffect(() => {
    const onPop = () => setView(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (ledger.migrated) toast.show(`이 기기에 있던 기록 ${ledger.migrated}건을 계정으로 옮겼어요.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.migrated]);

  function go(v: View) {
    window.history.pushState(null, "", urlOf(v));
    pushed.current = true;
    setView(v);
    window.scrollTo(0, 0);
  }

  function back() {
    if (pushed.current) {
      window.history.back();
      return;
    }
    // 주소로 바로 들어왔으면 뒤로 갈 곳이 이 앱이 아니다 — 첫 화면으로 바꿔 끼운다
    window.history.replaceState(null, "", urlOf(HOME));
    setView(HOME);
  }

  /** 밀린 변경을 먼저 보내 보고, 그래도 남으면 물어본 뒤 이 기기의 사본까지 지우고 나간다 */
  async function signOut() {
    if (!onSignOut) return;
    const sent = await ledger.flushNow();
    if (!sent && !window.confirm("아직 계정에 저장되지 않은 기록이 있어요. 지금 로그아웃하면 그 기록은 사라져요. 그래도 로그아웃할까요?")) return;
    ledger.clearLocal();
    onSignOut();
  }

  if (!ledger.ready) return <div className="app" />;

  // 지워졌거나 다른 기기에서 없앤 행사 주소면 첫 화면을 보여 준다
  const page = view.page === "event" && !current ? "home" : view.page;

  return (
    <div className="app">
      <nav className="wrap nav">
        {page === "home" ? (
          <>
            <span className="brand">
              <img className="brand-mark" src="/brand.png" alt="" />
              마음장부
            </span>
            {onSignOut && (
              <span className="nav-r">
                {who && <b>{who}</b>}
                <button type="button" onClick={signOut} title={username ?? undefined}>
                  로그아웃
                </button>
              </span>
            )}
          </>
        ) : (
          <>
            <button type="button" className="back" onClick={back}>
              ‹ 내 행사
            </button>
            <img className="brand-mark" src="/brand.png" alt="마음장부" />
          </>
        )}
      </nav>

      {ledger.expired && onSignOut ? (
        <div className="wrap save-error" role="alert">
          로그인이 만료됐어요. 다시 로그인하면 밀린 기록도 저장돼요.{" "}
          {/* 사본·대기열은 지우지 않는다 — 같은 계정으로 다시 들어오면 이어서 보낸다 */}
          <button type="button" className="link" onClick={onSignOut}>
            다시 로그인
          </button>
        </div>
      ) : (
        (ledger.saveFailed || ledger.loadFailed) && (
          <div className="wrap save-error" role="alert">
            {!ledger.cloud
              ? "이 브라우저에 저장하지 못하고 있어요. 시크릿 모드라면 일반 창에서 열어 주세요."
              : ledger.saveFailed
                ? "아직 계정에 저장되지 않은 기록이 있어요. 인터넷이 연결되면 자동으로 저장돼요. 그 전엔 이 탭을 닫지 마세요."
                : "계정에서 기록을 불러오지 못했어요. 이 기기에 있던 사본을 보여 주고 있어요."}
          </div>
        )
      )}

      {page === "home" ? (
        <Home
          events={events}
          gifts={gifts}
          onOpen={(id) => {
            setJustCreated(null);
            go({ page: "event", id });
          }}
          onAll={() => go({ page: "all" })}
          onNew={() => setModal("new")}
          onCover={(id, cover) => ledger.updateEvent(id, { cover })}
          toast={toast.show}
        />
      ) : (
        <LedgerPanel
          key={current?.id ?? "all"}
          ledger={ledger}
          event={current}
          focusName={!!current && justCreated === current.id}
          onEdit={() => setModal("edit")}
          toast={toast.show}
        />
      )}

      {modal === "new" && (
        <EventModal
          onClose={() => setModal(null)}
          onSave={(details) => {
            const e = ledger.createEvent(details);
            setJustCreated(e.id);
            setModal(null);
            go({ page: "event", id: e.id });
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
            back();
          }}
        />
      )}
      {toast.node}
    </div>
  );
}
