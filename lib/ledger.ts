"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as cloud from "./cloud";
import { DEFAULT_RELATIONS, typeInfo, type EventType } from "./events";
import { today } from "./format";

export interface LedgerEvent {
  id: string;
  type: EventType;
  title: string;
  date: string;
  /** "12:30" — 비어 있을 수 있음 */
  time?: string;
  place?: string;
  /** 대표 사진 (data URL) */
  cover?: string;
  createdAt: number;
}

export type EventDetails = Pick<LedgerEvent, "type" | "title" | "date" | "time" | "place" | "cover">;

export interface Gift {
  id: string;
  eventId: string;
  name: string;
  /** 원 단위 */
  amount: number;
  relation: string;
  createdAt: number;
}

export type GiftDetails = Pick<Gift, "name" | "amount" | "relation">;

export interface LedgerData {
  events: LedgerEvent[];
  gifts: Gift[];
  /** 마지막으로 보던 행사. null이면 전체 기록. 이 기기에만 저장 */
  currentEventId: string | null;
  /** 관계 버튼 목록 — 직접 더하거나 지울 수 있다 */
  relations: string[];
  /** 마지막으로 고른 관계. 손님은 무리지어 오니 바꾸기 전까지 그대로 둔다. 이 기기에만 저장 */
  lastRelation?: string;
}

/** 로그인 전(또는 클라우드 미설정)에 이 기기에만 저장하던 키 */
const LOCAL_KEY = "gyeongjo-ledger.v1";
const cacheKey = (user: string | null) => (user ? `maeum-ledger.${user}` : LOCAL_KEY);

const EMPTY: LedgerData = { events: [], gifts: [], currentEventId: null, relations: DEFAULT_RELATIONS };

function normalize(raw: Partial<LedgerData>): LedgerData {
  const d = { ...EMPTY, ...raw };
  d.gifts = (d.gifts ?? []).map((g) => ({ ...g, relation: g.relation ?? DEFAULT_RELATIONS[0] }));
  if (!d.relations?.length) d.relations = DEFAULT_RELATIONS;
  return d;
}

function read(key: string): LedgerData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** 재시도해도 소용없는 DynamoDB 오류 이름 */
const PERMANENT = new Set(["ValidationException", "AccessDeniedException", "ResourceNotFoundException", "ItemCollectionSizeLimitExceededException"]);
const pendingKey = (user: string | null) => `maeum-ledger.pending.${user}`;
function readPending(key: string): cloud.Op[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as cloud.Op[]) : [];
  } catch {
    return [];
  }
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/** 다른 기기 변경을 받아 오는 간격 (화면이 보일 때만) */
const SYNC_MS = 30_000;

/**
 * 장부 상태. user 가 있으면 DynamoDB 에 저장하고 이 기기에는 사본만 둔다(바로 뜨게).
 * user 가 없으면(클라우드 미설정) 예전처럼 이 기기에만 저장한다.
 */
export function useLedger(user: string | null) {
  const [data, setDataState] = useState<LedgerData>(EMPTY);
  const [ready, setReady] = useState(false);
  /** 클라우드에 못 보낸 변경이 남아 있다 (네트워크 등) */
  const [saveFailed, setSaveFailed] = useState(false);
  /** 서버에서 기록을 못 읽어 왔다 — 이 기기의 사본을 보여 주는 중 */
  const [loadFailed, setLoadFailed] = useState(false);
  /** 로그인이 풀려서 저장·불러오기를 못 하고 있다 */
  const [expired, setExpired] = useState(false);
  /** 처음 로그인하면서 이 기기 기록을 계정으로 옮긴 건수 */
  const [migrated, setMigrated] = useState(0);
  const dataRef = useRef<LedgerData>(EMPTY);
  /** 아직 클라우드에 반영 못 한 변경들. localStorage 에도 같이 두어 탭을 닫아도 남는다 */
  const pending = useRef<cloud.Op[]>([]);
  const flushing = useRef(false);
  const syncing = useRef(false);
  /** 이 기기에서 바꾼 횟수. 불러오는 사이에 바뀌었으면 불러온 것(옛 상태)으로 덮지 않는다 */
  const version = useRef(0);

  const savePending = useCallback(() => {
    try {
      const key = pendingKey(user);
      if (pending.current.length) localStorage.setItem(key, JSON.stringify(pending.current));
      else localStorage.removeItem(key);
    } catch {
      /* 저장소가 막혀 있어도 메모리 큐로는 계속 간다 */
    }
  }, [user]);

  /** 밀린 변경을 순서대로 보낸다. 하나라도 실패하면 거기서 멈추고 나중에 다시 */
  const flush = useCallback(async () => {
    if (!user || flushing.current) return;
    flushing.current = true;
    try {
      while (pending.current.length) {
        try {
          await cloud.run(pending.current[0]);
        } catch (e) {
          // 다시 보내도 똑같이 거절될 오류(항목 형식 등)는 버리고 다음으로. 네트워크 오류는 남겨 두고 멈춘다
          if (!PERMANENT.has((e as { name?: string })?.name ?? "")) throw e;
          console.error("저장 못 한 변경을 건너뜀", e);
        }
        pending.current = pending.current.slice(1);
        savePending();
      }
      setSaveFailed(false);
      setExpired(false);
    } catch (e) {
      setSaveFailed(true);
      setExpired(e instanceof cloud.SessionExpired);
    } finally {
      flushing.current = false;
    }
  }, [user, savePending]);

  const commit = useCallback(
    (next: LedgerData) => {
      dataRef.current = next;
      setDataState(next);
      try {
        localStorage.setItem(cacheKey(user), JSON.stringify(next));
        if (!user) setSaveFailed(false);
      } catch {
        if (!user) setSaveFailed(true);
      }
    },
    [user],
  );

  /**
   * 밀린 변경을 보내고 서버 것을 받아 온다. 처음 열 때, 탭으로 돌아올 때, 화면이 보이는 동안 주기적으로.
   * 행사·기록·관계는 서버 것이 기준이고, 보던 행사·마지막 관계는 이 기기 것을 그대로 둔다.
   */
  const sync = useCallback(async () => {
    if (!user || syncing.current) return;
    syncing.current = true;
    try {
      // 못 보낸 변경이 남아 있으면 서버 것을 받지 않는다(이 기기 변경이 더 최신이니까)
      await flush();
      if (pending.current.length) {
        setLoadFailed(true);
        return;
      }
      const seen = version.current;
      let remote = await cloud.loadAll();
      if (!remote) {
        const local = read(LOCAL_KEY);
        if (local && (local.events.length || local.gifts.length)) {
          remote = { events: local.events, gifts: local.gifts, relations: local.relations };
          await cloud.uploadAll(remote);
          localStorage.removeItem(LOCAL_KEY);
          setMigrated(local.gifts.length + local.events.length);
        } else {
          // 빈 계정도 관계 버튼은 저장해 둔다 (하나씩 저장하므로 기본 목록이 서버에 있어야 한다)
          remote = { events: [], gifts: [], relations: DEFAULT_RELATIONS };
          await cloud.uploadAll(remote);
        }
      }
      if (version.current === seen && !pending.current.length) {
        const cur = dataRef.current;
        const currentEventId = remote.events.some((e) => e.id === cur.currentEventId) ? cur.currentEventId : null;
        commit(normalize({ ...remote, currentEventId, lastRelation: cur.lastRelation }));
      }
      setLoadFailed(false);
      setExpired(false);
    } catch (e) {
      setLoadFailed(true);
      setExpired(e instanceof cloud.SessionExpired);
    } finally {
      syncing.current = false;
    }
  }, [user, flush, commit]);

  useEffect(() => {
    const cached = read(cacheKey(user));
    if (cached) {
      dataRef.current = cached;
      setDataState(cached);
      setReady(true);
    }
    if (!user) {
      setReady(true);
      return;
    }
    pending.current = readPending(pendingKey(user));
    void sync().finally(() => setReady(true));

    const visible = () => document.visibilityState === "visible";
    // 인터넷이 돌아오면 밀린 것을 다시 보낸다
    const onOnline = () => void flush();
    const onVisible = () => visible() && void sync();
    const timer = setInterval(onVisible, SYNC_MS);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, sync, flush]);

  /** 상태를 바꾸고, 로그인 상태면 같은 변경을 클라우드에도 순서대로 보낸다 */
  const mutate = useCallback(
    (fn: (d: LedgerData) => LedgerData, ops?: (next: LedgerData) => cloud.Op[]) => {
      const next = fn(dataRef.current);
      version.current++;
      commit(next);
      if (user && ops) {
        pending.current = [...pending.current, ...ops(next)];
        savePending();
        void flush();
      }
    },
    [user, commit, savePending, flush],
  );

  const createEvent = useCallback(
    (details: EventDetails) => {
      const event: LedgerEvent = {
        id: newId(),
        ...details,
        title: details.title || typeInfo(details.type).label,
        date: details.date || today(),
        createdAt: Date.now(),
      };
      mutate(
        (d) => ({ ...d, events: [...d.events, event], currentEventId: event.id }),
        () => [{ t: "event", item: event }],
      );
      return event;
    },
    [mutate],
  );

  // 보던 행사는 이 기기에만 둔다 (기기마다 다른 행사를 보고 있을 수 있다)
  const openEvent = useCallback(
    (id: string | null) => mutate((d) => ({ ...d, currentEventId: id })),
    [mutate],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<Omit<LedgerEvent, "id">>) =>
      mutate(
        (d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
        (n) => {
          const e = n.events.find((x) => x.id === id);
          return e ? [{ t: "event", item: e }] : [];
        },
      ),
    [mutate],
  );

  const deleteEvent = useCallback(
    (id: string) => {
      const giftIds = dataRef.current.gifts.filter((g) => g.eventId === id).map((g) => g.id);
      mutate(
        (d) => ({
          ...d,
          events: d.events.filter((e) => e.id !== id),
          gifts: d.gifts.filter((g) => g.eventId !== id),
          currentEventId: d.currentEventId === id ? null : d.currentEventId,
        }),
        () => [{ t: "delEvent", id, giftIds }],
      );
    },
    [mutate],
  );

  const addGift = useCallback(
    (eventId: string, details: GiftDetails) => {
      const gift: Gift = { id: newId(), eventId, ...details, createdAt: Date.now() };
      mutate(
        (d) => ({ ...d, gifts: [...d.gifts, gift], lastRelation: gift.relation }),
        () => [{ t: "gift", item: gift }],
      );
      return gift;
    },
    [mutate],
  );

  const updateGift = useCallback(
    (id: string, patch: Partial<GiftDetails>) =>
      mutate(
        (d) => ({ ...d, gifts: d.gifts.map((g) => (g.id === id ? { ...g, ...patch } : g)) }),
        (n) => {
          const g = n.gifts.find((x) => x.id === id);
          return g ? [{ t: "gift", item: g }] : [];
        },
      ),
    [mutate],
  );

  const removeGift = useCallback(
    (id: string) => mutate((d) => ({ ...d, gifts: d.gifts.filter((g) => g.id !== id) }), () => [{ t: "delGift", id }]),
    [mutate],
  );

  const restoreGift = useCallback(
    (gift: Gift) =>
      mutate(
        (d) => (d.gifts.some((g) => g.id === gift.id) ? d : { ...d, gifts: [...d.gifts, gift] }),
        () => [{ t: "gift", item: gift }],
      ),
    [mutate],
  );

  // 관계는 하나씩 따로 저장한다. 목록을 통째로 쓰면 다른 기기에서 더한 관계를 지워 버린다
  const addRelation = useCallback(
    (name: string) => {
      if (dataRef.current.relations.includes(name)) return;
      mutate((d) => ({ ...d, relations: [...d.relations, name] }), () => [{ t: "rel", name, order: Date.now() }]);
    },
    [mutate],
  );

  const removeRelation = useCallback(
    (name: string) => mutate((d) => ({ ...d, relations: d.relations.filter((r) => r !== name) }), () => [{ t: "delRel", name }]),
    [mutate],
  );

  /** 밀린 변경을 지금 보내 본다. 다 보냈으면 true */
  const flushNow = useCallback(async () => {
    await flush();
    return pending.current.length === 0;
  }, [flush]);

  /** 로그아웃할 때 이 기기에 남은 사본과 대기열을 지운다 (공용 기기에 이름·금액이 남지 않게) */
  const clearLocal = useCallback(() => {
    if (!user) return;
    pending.current = [];
    try {
      localStorage.removeItem(cacheKey(user));
      localStorage.removeItem(pendingKey(user));
    } catch {
      /* ignore */
    }
  }, [user]);

  return {
    data,
    ready,
    saveFailed,
    loadFailed,
    expired,
    migrated,
    flushNow,
    clearLocal,
    cloud: !!user,
    createEvent,
    openEvent,
    updateEvent,
    deleteEvent,
    addGift,
    updateGift,
    removeGift,
    restoreGift,
    addRelation,
    removeRelation,
  };
}

export type Ledger = ReturnType<typeof useLedger>;
