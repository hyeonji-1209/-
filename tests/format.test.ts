import { test } from "node:test";
import assert from "node:assert/strict";
import { clockLabel, fullWhen, maskDate, money, parseDate, parseMan } from "../lib/format.ts";

test("money: 만원 단위로 줄여 보여 준다", () => {
  assert.equal(money(0), "0만원");
  assert.equal(money(50000), "5만원");
  assert.equal(money(125000), "12.5만원");
  assert.equal(money(1000000), "100만원");
  assert.equal(money(12340000), "1,234만원");
  assert.equal(money(3000), "3,000원");
});

test("parseMan: 만원 입력을 원으로", () => {
  assert.equal(parseMan("10"), 100000);
  assert.equal(parseMan("2.5"), 25000);
  assert.equal(parseMan("0.3"), 3000);
  assert.equal(parseMan(""), 0);
  assert.equal(parseMan("0"), 0);
  assert.equal(parseMan("abc"), 0);
  assert.equal(parseMan("1,0"), 100000);
});

test("maskDate: 숫자만 쳐도 점을 찍는다", () => {
  assert.equal(maskDate("2026"), "2026");
  assert.equal(maskDate("20261"), "2026.1");
  assert.equal(maskDate("20261107"), "2026.11.07");
  assert.equal(maskDate("2026-11-07"), "2026.11.07");
  assert.equal(maskDate("2026110799"), "2026.11.07");
});

test("parseDate: 없는 날짜는 null", () => {
  assert.equal(parseDate("2026.11.07"), "2026-11-07");
  assert.equal(parseDate("2024.02.29"), "2024-02-29");
  assert.equal(parseDate("2026.02.29"), null);
  assert.equal(parseDate("2026.13.01"), null);
  assert.equal(parseDate("1899.01.01"), null);
  assert.equal(parseDate("2026.11"), null);
});

test("fullWhen / clockLabel: 오전·오후와 요일", () => {
  assert.equal(fullWhen("2026-10-14"), "2026년 10월 14일 (수)");
  assert.equal(fullWhen("2026-10-14", "10:03"), "2026년 10월 14일 (수) 오전 10:03");
  assert.equal(fullWhen("2026-10-14", "12:00"), "2026년 10월 14일 (수) 오후 12:00");
  assert.equal(fullWhen(""), "");
  assert.equal(clockLabel("00:30"), "오전 12:30");
  assert.equal(clockLabel("13:30"), "오후 1:30");
});
