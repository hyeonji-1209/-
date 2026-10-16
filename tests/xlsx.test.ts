import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { makeXlsx } from "../lib/xlsx.ts";

/** 압축 없는 zip 을 central directory 기준으로 풀어 { 이름: 내용 } 으로 */
function unzip(buf: Buffer): Record<string, string> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "end of central directory 가 있어야 한다");
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    assert.equal(buf.readUInt32LE(local), 0x04034b50, `${name} 의 local header`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    p += 46 + nameLen;
  }
  return out;
}

test("makeXlsx: 엑셀이 여는 데 필요한 파일이 다 들어 있다", async () => {
  const blob = makeXlsx("결혼식", [["이름", "금액"], ["홍길동", 50000]]);
  const files = unzip(Buffer.from(await blob.arrayBuffer()));
  for (const f of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(f in files, `${f} 가 있어야 한다`);
  }
  assert.match(files["xl/workbook.xml"], /<sheet name="결혼식"/);
});

test("makeXlsx: 숫자는 콤마 서식 숫자 칸, 글자는 이스케이프된 inline 문자열", async () => {
  const blob = makeXlsx("s", [[{ v: "합계", bold: true }, 1234567, { v: 10, bold: true }], ["<a & b>"]]);
  const sheet = unzip(Buffer.from(await blob.arrayBuffer()))["xl/worksheets/sheet1.xml"];
  assert.match(sheet, /<c r="A1" t="inlineStr" s="2">/);
  assert.match(sheet, /<c r="B1" s="1"><v>1234567<\/v><\/c>/);
  assert.match(sheet, /<c r="C1" s="3"><v>10<\/v><\/c>/);
  assert.match(sheet, /&lt;a &amp; b&gt;/);
});

test("makeXlsx: 시트 이름의 금지 문자와 길이 제한", async () => {
  const blob = makeXlsx("a/b:c*d?".padEnd(40, "x"), [["x"]]);
  const wb = unzip(Buffer.from(await blob.arrayBuffer()))["xl/workbook.xml"];
  const name = wb.match(/<sheet name="([^"]*)"/)![1];
  assert.ok(!/[\[\]:*?/\\]/.test(name));
  assert.ok(name.length <= 31);
});
