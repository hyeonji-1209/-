"use client";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchAuthSession } from "aws-amplify/auth";
import { env } from "./amplify";
import type { Gift, LedgerData, LedgerEvent } from "./ledger";

/* DynamoDB 한 테이블. pk = 로그인한 사람의 아이덴티티 ID, sk = EVENT#id | GIFT#id | META
   IAM 조건(LeadingKeys) 덕분에 다른 사람 pk 는 애초에 읽고 쓸 수 없다. */

export type Meta = Pick<LedgerData, "relations" | "currentEventId" | "lastRelation">;

let cached: { key: string; doc: DynamoDBDocumentClient } | null = null;

async function conn() {
  const s = await fetchAuthSession();
  if (!s.credentials || !s.identityId) throw new Error("로그인이 필요해요");
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
const SK_META = "META";

type Row = Record<string, unknown> & { pk: string; sk: string };

/** 내 항목 전부. 아무것도 없으면 null (처음 로그인) */
export async function loadAll(): Promise<LedgerData | null> {
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
  const meta = rows.find((r) => r.sk === SK_META);
  return {
    events,
    gifts,
    relations: (meta?.relations as string[] | undefined) ?? [],
    currentEventId: (meta?.currentEventId as string | null | undefined) ?? null,
    lastRelation: meta?.lastRelation as string | undefined,
  };
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

export async function putMeta(m: Meta) {
  const { doc, pk } = await conn();
  await doc.send(new PutCommand({ TableName: T, Item: { pk, sk: SK_META, ...m } }));
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

/** 처음 로그인했을 때 이 기기에 있던 기록을 통째로 올린다 */
export async function uploadAll(d: LedgerData) {
  const { doc, pk } = await conn();
  await batch(doc, [
    ...d.events.map((e) => ({ PutRequest: { Item: { pk, sk: skEvent(e.id), ...e } } })),
    ...d.gifts.map((g) => ({ PutRequest: { Item: { pk, sk: skGift(g.id), ...g } } })),
    { PutRequest: { Item: { pk, sk: SK_META, relations: d.relations, currentEventId: d.currentEventId, lastRelation: d.lastRelation } } },
  ]);
}
