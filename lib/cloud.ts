"use client";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchAuthSession } from "aws-amplify/auth";
import { env } from "./amplify";
import { DEFAULT_RELATIONS } from "./events";
import type { Gift, LedgerEvent } from "./ledger";

/* DynamoDB 한 테이블. pk = 로그인한 사람의 아이덴티티 ID, sk = EVENT#id | GIFT#id | REL#이름
   IAM 조건(LeadingKeys) 덕분에 다른 사람 pk 는 애초에 읽고 쓸 수 없다.
   관계 버튼은 하나씩 따로 저장한다. 목록을 통째로 쓰면 두 기기에서 동시에 고칠 때 한쪽 변경이 지워지기 때문.
   (예전엔 META 한 항목에 목록을 통째로 넣었다 — 처음 불러올 때 REL# 로 옮긴다) */

/** 클라우드에 두는 것. 보던 행사·마지막 관계 같은 화면 상태는 기기마다 따로라 여기 없다 */
export interface Remote {
  events: LedgerEvent[];
  gifts: Gift[];
  relations: string[];
}

/** 로그인이 풀렸다(리프레시 토큰 만료 등). 다시 로그인해야 밀린 변경을 보낼 수 있다 */
export class SessionExpired extends Error {
  name = "SessionExpired";
}

let cached: { key: string; doc: DynamoDBDocumentClient } | null = null;

async function conn() {
  const s = await fetchAuthSession().catch((e) => {
    throw (e as { name?: string })?.name === "NotAuthorizedException" ? new SessionExpired() : e;
  });
  // 토큰이 없으면 로그인이 풀린 것. 토큰은 있는데 자격 증명만 없으면 보통 네트워크 문제다
  if (!s.tokens) throw new SessionExpired();
  if (!s.credentials || !s.identityId) throw new Error("로그인 정보를 받지 못했어요");
  const key = s.credentials.accessKeyId;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      doc: DynamoDBDocumentClient.from(new DynamoDBClient({ region: env.region, credentials: s.credentials }), {
        marshallOptions: { removeUndefinedValues: true },
      }),
    };
  }
  return { doc: cached.doc, pk: s.identityId };
}

const T = env.table;
const skEvent = (id: string) => `EVENT#${id}`;
const skGift = (id: string) => `GIFT#${id}`;
const skRel = (name: string) => `REL#${name}`;
const SK_META = "META";

type Row = Record<string, unknown> & { pk: string; sk: string };

const relPut = (pk: string, name: string, order: number) => ({ PutRequest: { Item: { pk, sk: skRel(name), name, order } } });

/** 내 항목 전부. 아무것도 없으면 null (처음 로그인) */
export async function loadAll(): Promise<Remote | null> {
  const { doc, pk } = await conn();
  const rows: Row[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const r = await doc.send(new QueryCommand({ TableName: T, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ExclusiveStartKey: start }));
    rows.push(...((r.Items ?? []) as Row[]));
    start = r.LastEvaluatedKey;
  } while (start);
  if (rows.length === 0) return null;

  const strip = <X>(row: Row) => {
    const { pk: _p, sk: _s, ...rest } = row;
    return rest as X;
  };
  const events = rows.filter((r) => r.sk.startsWith("EVENT#")).map((r) => strip<LedgerEvent>(r));
  const gifts = rows.filter((r) => r.sk.startsWith("GIFT#")).map((r) => strip<Gift>(r));
  let relations = rows
    .filter((r) => r.sk.startsWith("REL#"))
    .sort((a, b) => (a.order as number) - (b.order as number))
    .map((r) => r.name as string);
  if (!relations.length) {
    // 관계를 아직 따로 저장한 적 없는 계정: 예전 META 목록(없으면 기본값)을 옮겨 둔다
    const legacy = rows.find((r) => r.sk === SK_META)?.relations as string[] | undefined;
    relations = legacy?.length ? legacy : DEFAULT_RELATIONS;
    await batch(doc, relations.map((name, i) => relPut(pk, name, i)));
  }
  return { events, gifts, relations };
}

export async function putEvent(e: LedgerEvent) {
  const { doc, pk } = await conn();
  await doc.send(new PutCommand({ TableName: T, Item: { pk, sk: skEvent(e.id), ...e } }));
}

export async function putGift(g: Gift) {
  const { doc, pk } = await conn();
  await doc.send(new PutCommand({ TableName: T, Item: { pk, sk: skGift(g.id), ...g } }));
}

export async function deleteGift(id: string) {
  const { doc, pk } = await conn();
  await doc.send(new DeleteCommand({ TableName: T, Key: { pk, sk: skGift(id) } }));
}

export async function putRelation(name: string, order: number) {
  const { doc, pk } = await conn();
  await doc.send(new PutCommand({ TableName: T, Item: { pk, sk: skRel(name), name, order } }));
}

export async function deleteRelation(name: string) {
  const { doc, pk } = await conn();
  await doc.send(new DeleteCommand({ TableName: T, Key: { pk, sk: skRel(name) } }));
}

/** 25개씩 끊어서 보내고, 못 쓴 건 다시 보낸다 */
async function batch(doc: DynamoDBDocumentClient, requests: Record<string, unknown>[]) {
  for (let i = 0; i < requests.length; i += 25) {
    let pending = requests.slice(i, i + 25);
    for (let tries = 0; pending.length && tries < 5; tries++) {
      const r = await doc.send(new BatchWriteCommand({ RequestItems: { [T]: pending } }));
      pending = (r.UnprocessedItems?.[T] ?? []) as Record<string, unknown>[];
      if (pending.length) await new Promise((res) => setTimeout(res, 200 * (tries + 1)));
    }
    if (pending.length) throw new Error("일부 기록을 저장하지 못했어요");
  }
}

export async function deleteEvent(id: string, giftIds: string[]) {
  const { doc, pk } = await conn();
  await batch(doc, [skEvent(id), ...giftIds.map(skGift)].map((sk) => ({ DeleteRequest: { Key: { pk, sk } } })));
}

/** 로컬에서 바꾼 내용을 클라우드에 똑같이 적용하는 한 단위. 직렬화해서 localStorage 에 쌓아 두므로 함수가 아니라 데이터다. */
export type Op =
  | { t: "event"; item: LedgerEvent }
  | { t: "gift"; item: Gift }
  | { t: "delGift"; id: string }
  | { t: "delEvent"; id: string; giftIds: string[] }
  | { t: "rel"; name: string; order: number }
  | { t: "delRel"; name: string }
  /** 예전 버전이 대기열에 남겨 둔 것. 이제 쓰지 않으니 그냥 넘긴다 */
  | { t: "meta" };

export function run(op: Op): Promise<unknown> {
  switch (op.t) {
    case "event":
      return putEvent(op.item);
    case "gift":
      return putGift(op.item);
    case "delGift":
      return deleteGift(op.id);
    case "delEvent":
      return deleteEvent(op.id, op.giftIds);
    case "rel":
      return putRelation(op.name, op.order);
    case "delRel":
      return deleteRelation(op.name);
    case "meta":
      return Promise.resolve();
  }
}

/** 처음 로그인했을 때 이 기기에 있던 기록을 통째로 올린다 */
export async function uploadAll(d: Remote) {
  const { doc, pk } = await conn();
  await batch(doc, [
    ...d.events.map((e) => ({ PutRequest: { Item: { pk, sk: skEvent(e.id), ...e } } })),
    ...d.gifts.map((g) => ({ PutRequest: { Item: { pk, sk: skGift(g.id), ...g } } })),
    ...d.relations.map((name, i) => relPut(pk, name, i)),
  ]);
}
