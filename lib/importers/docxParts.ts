// Header / footer text of a .docx (2026-10-31).
//
// mammoth.extractRawText reads word/document.xml only. Word CV templates very
// commonly put the candidate's name and contact line in the page HEADER, so
// the import came back with experience and skills but no name or email. This
// module reads word/header*.xml and word/footer*.xml itself.
//
// Dependency-free on purpose: a .docx is a zip, the zip central directory is
// a fixed-layout record, and the browser's DecompressionStream("deflate-raw")
// inflates the two or three small XML parts we need. Everything here is
// best-effort — any failure returns empty text and the body import proceeds.

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

type Entry = {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function readEntries(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The End of Central Directory record sits in the last 22 + comment bytes.
  const floor = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip: no end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const entries: Entry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count && pos + 46 <= bytes.length; n++) {
    if (view.getUint32(pos, true) !== SIG_CENTRAL) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    const name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    entries.push({ name, method, compressedSize, localHeaderOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateEntry(bytes: Uint8Array, e: Entry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const h = e.localHeaderOffset;
  if (view.getUint32(h, true) !== SIG_LOCAL) throw new Error("bad local header");
  const nameLen = view.getUint16(h + 26, true);
  const extraLen = view.getUint16(h + 28, true);
  const start = h + 30 + nameLen + extraLen;
  const data = bytes.subarray(start, start + e.compressedSize);
  if (e.method === 0) return data;
  if (e.method !== 8) throw new Error(`unsupported zip method ${e.method}`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream unavailable");
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};
const unescapeXml = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (m, _n, dec, hex) =>
    dec
      ? String.fromCodePoint(Number(dec))
      : hex
        ? String.fromCodePoint(parseInt(hex, 16))
        : (ENTITIES[m.toLowerCase()] ?? m),
  );

/** Paragraph texts of a WordprocessingML part: `<w:p>` → one line, `<w:t>`
 *  runs concatenated, tabs and breaks → space / newline. Regex over the XML
 *  is enough here: the parts are small and we need text, not structure. */
export function paragraphsFromWordXml(xml: string): string[] {
  const out: string[] = [];
  const paraRe = /<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(xml)) !== null) {
    const inner = m[0];
    let text = "";
    const tokRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g;
    let t: RegExpExecArray | null;
    while ((t = tokRe.exec(inner)) !== null) {
      if (t[1] !== undefined) text += unescapeXml(t[1]);
      else if (t[0].startsWith("<w:tab")) text += " ";
      else text += "\n";
    }
    const line = text.replace(/[ \t]+/g, " ").trim();
    if (line) out.push(line);
  }
  return out;
}

export type DocxParts = { headers: string[]; footers: string[] };

/** Distinct paragraph lines from every header and footer part of a .docx.
 *  Throws only on a broken zip — callers treat any throw as "no extra text". */
export async function readDocxHeaderFooter(buffer: ArrayBuffer): Promise<DocxParts> {
  const bytes = new Uint8Array(buffer);
  const entries = readEntries(bytes);
  const headers: string[] = [];
  const footers: string[] = [];
  const seen = new Set<string>();
  const dec = new TextDecoder();
  for (const e of entries) {
    const kind = /^word\/(header|footer)\d*\.xml$/.exec(e.name)?.[1];
    if (!kind) continue;
    const xml = dec.decode(await inflateEntry(bytes, e));
    for (const line of paragraphsFromWordXml(xml)) {
      // Word duplicates the "default" header into first/even variants; the
      // same line twice would read as two contact blocks to the parser.
      if (seen.has(line)) continue;
      seen.add(line);
      (kind === "header" ? headers : footers).push(line);
    }
  }
  return { headers, footers };
}

const CONTACT_RE = /@|\+?\d[\d\s().-]{7,}\d|linkedin\.com|https?:\/\/|www\./i;

/** Footer lines worth keeping: only ones that carry contact details. Page
 *  numbers and "References available on request" would otherwise be glued
 *  onto whatever section the body ends with. */
export function contactLinesOnly(lines: string[]): string[] {
  return lines.filter((l) => CONTACT_RE.test(l));
}
