/* 라이브러리 없이 만드는 .xlsx — 시트 하나짜리 통합 문서를 압축 없는 zip으로 묶는다. */

/** 문자열·숫자, 또는 { v, bold } 로 굵게. 숫자는 항상 1,000 단위 콤마가 붙는다 */
export type Cell = string | number | { v: string | number; bold?: boolean };

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; text: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const header = (sig: number, name: Uint8Array, data: Uint8Array, crc: number, extra: number[]) => {
    const h = new DataView(new ArrayBuffer(sig === 0x04034b50 ? 30 : 46));
    let p = 0;
    const u16 = (v: number) => (h.setUint16(p, v, true), (p += 2));
    const u32 = (v: number) => (h.setUint32(p, v, true), (p += 4));
    u32(sig);
    if (sig === 0x02014b50) u16(20);
    u16(20); u16(0x0800); u16(0); u16(dosTime); u16(dosDate);
    u32(crc); u32(data.length); u32(data.length); u16(name.length); u16(0);
    extra.forEach((v, i) => (i === 3 ? u32(v) : i === 4 ? u32(v) : u16(v)));
    return new Uint8Array(h.buffer);
  };

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const local = header(0x04034b50, name, data, crc, []);
    central.push(header(0x02014b50, name, data, crc, [0, 0, 0, 0, offset]), name);
    parts.push(local, name, data);
    offset += local.length + name.length + data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (i: number) => {
  let s = "";
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
};

/** 숫자는 숫자 칸(콤마 서식)으로 들어가서 엑셀에서 바로 합계를 낼 수 있다. */
export function makeXlsx(sheetName: string, rows: Cell[][], widths: number[] = []): Blob {
  const name = esc(sheetName.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet1");
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const body = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">` +
        r
          .map((cell, ci) => {
            const ref = `${col(ci)}${ri + 1}`;
            const bold = typeof cell === "object" && !!cell.bold;
            const v = typeof cell === "object" ? cell.v : cell;
            // cellXfs: 0 기본, 1 숫자(콤마), 2 굵게, 3 굵은 숫자(콤마)
            if (typeof v === "number") return `<c r="${ref}" s="${bold ? 3 : 1}"><v>${v}</v></c>`;
            return `<c r="${ref}" t="inlineStr"${bold ? ' s="2"' : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
          })
          .join("") +
        "</row>",
    )
    .join("");
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    {
      name: "[Content_Types].xml",
      text:
        `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      text:
        `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text:
        `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text:
        `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      text:
        `${xml}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts>` +
        `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
        `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="4">` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
        `<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
        `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
        `<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>` +
        `</cellXfs>` +
        `</styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: `${xml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`,
    },
  ]);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
