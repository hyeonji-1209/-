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
  /** 마지막으로 보던 행사. null이면 전체 기록 */
  currentEventId: string | null;
  /** 관계 버튼 목록 — 직접 더하거나 지울 수 있다 */
  relations: string[];
  /** 마지막으로 고른 관계. 손님은 무리지어 오니 바꾸기 전까지 그대로 둔다 */
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

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const metaOf = (d: LedgerData): cloud.Meta => ({ relations: d.relations, currentEventId: d.currentEventId, lastRelation: d.lastRelation });

/**
 * 장부 상태. user 가 있으면 DynamoDB 에 저장하고 이 기기에는 사본만 둔다(바로 뜨게).
 * user 가 없으면(클라우드 미설정) 예전처럼 이 기기에만 저장한다.
 */
export function useLedger(user: string | null) {
  const [data, setDataState] = useState<LedgerData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** 처음 로그인하면서 이 기기 기록을 계정으로 옮긴 건수 */
  const [migrated, setMigrated] = useState(0);
  const dataRef = useRef<LedgerData>(EMPTY);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

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

  useEffect(() => {
    let alive = true;
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
    (async () => {
      try {
        let remote = await cloud.loadAll();
        if (!remote) {
          const local = read(LOCAL_KEY);
          if (local && (local.events.length || local.gifts.length)) {
            await cloud.uploadAll(local);
            remote = local;
            localStorage.removeItem(LOCAL_KEY);
            if (alive) setMigrated(local.gifts.length + local.events.length);
          } else remote = EMPTY;
        }
        if (alive) commit(normalize(remote));
      } catch {
        if (alive) setSaveFailed(true);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, commit]);

  /** 상태를 바꾸고, 로그인 상태면 같은 변경을 클라우드에도 순서대로 보낸다 */
  const mutate = useCallback(
    (fn: (d: LedgerData) => LedgerData, op?: (next: LedgerData) => Promise<unknown>) => {
      const next = fn(dataRef.current);
      commit(next);
      if (user && op) {
        queue.current = queue.current.then(() => op(next)).then(
          () => setSaveFailed(false),
          () => setSaveFailed(true),
        );
      }
    },
    [user, commit],
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
        async (n) => {
          await cloud.putEvent(event);
          await cloud.putMeta(metaOf(n));
        },
      );
      return event;
    },
    [mutate],
  );

  const openEvent = useCallback(
    (id: string | null) => mutate((d) => ({ ...d, currentEventId: id }), (n) => cloud.putMeta(metaOf(n))),
    [mutate],
  );

  const updateEvent = useCallback(
    (id: string, patch: Partial<Omit<LedgerEvent, "id">>) =>
      mutate(
        (d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
        (n) => {
          const e = n.events.find((x) => x.id === id);
          return e ? cloud.putEvent(e) : Promise.resolve();
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
        async (n) => {
          await cloud.deleteEvent(id, giftIds);
          await cloud.putMeta(metaOf(n));
        },
      );
    },
    [mutate],
  );

  const addGift = useCallback(
    (eventId: string, details: GiftDetails) => {
      const gift: Gift = { id: newId(), eventId, ...details, createdAt: Date.now() };
      mutate(
        (d) => ({ ...d, gifts: [...d.gifts, gift], lastRelation: gift.relation }),
        async (n) => {
          await cloud.putGift(gift);
          await cloud.putMeta(metaOf(n));
        },
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
          return g ? cloud.putGift(g) : Promise.resolve();
        },
      ),
    [mutate],
  );

  const removeGift = useCallback(
    (id: string) => mutate((d) => ({ ...d, gifts: d.gifts.filter((g) => g.id !== id) }), () => cloud.deleteGift(id)),
    [mutate],
  );

  const restoreGift = useCallback(
    (gift: Gift) =>
      mutate(
        (d) => (d.gifts.some((g) => g.id === gift.id) ? d : { ...d, gifts: [...d.gifts, gift] }),
        () => cloud.putGift(gift),
      ),
    [mutate],
  );

  const addRelation = useCallback(
    (name: string) =>
      mutate((d) => (d.relations.includes(name) ? d : { ...d, relations: [...d.relations, name] }), (n) => cloud.putMeta(metaOf(n))),
    [mutate],
  );

  const removeRelation = useCallback(
    (name: string) => mutate((d) => ({ ...d, relations: d.relations.filter((r) => r !== name) }), (n) => cloud.putMeta(metaOf(n))),
    [mutate],
  );

  return {
    data,
    ready,
    saveFailed,
    migrated,
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
