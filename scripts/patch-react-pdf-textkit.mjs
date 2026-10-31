// Patch @react-pdf/textkit 6.1.0's bidi reorder (session 6, 2026-10-31, E8.1).
// Runs on `postinstall`; idempotent; never fails an install.
//
// The defect. textkit splits a paragraph into runs at every bidi-level change
// (bidiEngine: an Arabic line with "8", "94%" or "SAP IBP" in it is 3–7 runs).
// `reorderLine` then computes the line's visual order but KEEPS each run's
// logical length and refills it with the visual-order glyphs: the run that
// held the 1-character "8" now draws the one visual glyph at that position,
// which is a letter in the middle of some Arabic word. Every run is rendered
// as its own BT … TJ … ET block, so the text-show operators of a mixed Arabic
// line are cut at arbitrary points inside words. pdf.js and pypdf reverse each
// operator's text on its own and lose the cut words (session 5: persona A
// bullet b1 lost 3 of 14 Arabic words, b2 1 of 7); PyMuPDF scrambles them.
// The same refill is why a glyph could be drawn with a NEIGHBOURING run's
// font (the reason a Latin + Arabic font stack corrupts the subset), and the
// ligature dedupe keyed on `glyph.id` drops the second identical ligature on a
// line.
//
// The fix. Re-segment the line in VISUAL order: every glyph keeps the run it
// came from (font, size, colour, link), consecutive glyphs whose runs draw
// alike (all attributes equal except bidiLevel / script) become one run, and a
// glyph that covers several characters is drawn once per occurrence (keyed by
// run + glyph index, not glyph id). A pure-Arabic or mixed line set in one
// face is then ONE text-show operator. Lines that need no reordering (every
// Latin-only line) return before this code, so Latin output is unchanged.
//
// If textkit is upgraded and the anchor no longer matches, this prints a
// warning and leaves the file alone; `npm run test:textkit-patch` (part of
// `npm test`, so CI) then fails until the patch is ported or dropped.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const MARKER = "makemycv-textkit-visual-runs v1";

export const ANCHOR = [
  "    const updatedRuns = line.runs.map((run) => {",
  "        const selectedIndices = indices.slice(run.start, run.end);",
  "        const updatedGlyphs = [];",
  "        const updatedPositions = [];",
  "        const addedGlyphs = new Set();",
  "        for (let i = 0; i < selectedIndices.length; i += 1) {",
  "            const index = selectedIndices[i];",
  "            const glyph = getItemAtIndex(line.runs, 'glyphs', index);",
  "            if (addedGlyphs.has(glyph.id))",
  "                continue;",
  "            updatedGlyphs.push(glyph);",
  "            updatedPositions.push(getItemAtIndex(line.runs, 'positions', index));",
  "            if (glyph.isLigature) {",
  "                addedGlyphs.add(glyph.id);",
  "            }",
  "        }",
  "        return {",
  "            ...run,",
  "            glyphs: updatedGlyphs,",
  "            positions: updatedPositions,",
  "        };",
  "    });",
].join("\n");

const REPLACEMENT = [
  `    /* ${MARKER} — scripts/patch-react-pdf-textkit.mjs in makemycv-app.`,
  "       Runs are rebuilt in visual order: each glyph keeps its own run, and",
  "       adjacent glyphs whose runs draw alike share one run (one TJ). */",
  "    const sourceRunAt = (index) => {",
  "        for (let r = 0; r < line.runs.length; r += 1) {",
  "            const run = line.runs[r];",
  "            if (index >= run.start && index < run.end)",
  "                return r;",
  "        }",
  "        throw new Error(`index ${index} out of range`);",
  "    };",
  "    const drawsAlike = (a, b) => {",
  "        if (a === b)",
  "            return true;",
  "        const attrsA = a.attributes || {};",
  "        const attrsB = b.attributes || {};",
  "        const keys = new Set([...Object.keys(attrsA), ...Object.keys(attrsB)]);",
  "        for (const key of keys) {",
  "            if (key === 'bidiLevel' || key === 'script')",
  "                continue;",
  "            const va = attrsA[key];",
  "            const vb = attrsB[key];",
  "            if (va === vb)",
  "                continue;",
  "            if (Array.isArray(va) && Array.isArray(vb) && va.length === vb.length && va.every((v, i) => v === vb[i]))",
  "                continue;",
  "            return false;",
  "        }",
  "        return true;",
  "    };",
  "    const visualRuns = [];",
  "    const drawn = new Map();",
  "    let current = null;",
  "    for (let k = 0; k < indices.length; k += 1) {",
  "        const index = indices[k];",
  "        const r = sourceRunAt(index);",
  "        const source = line.runs[r];",
  "        if (!current || !drawsAlike(current.source, source)) {",
  "            current = { source, start: k, end: k, glyphs: [], positions: [], glyphIndices: [] };",
  "            visualRuns.push(current);",
  "        }",
  "        current.end = k + 1;",
  "        const glyphIndex = source.glyphIndices[index - source.start];",
  "        const key = r + ':' + glyphIndex;",
  "        if (drawn.has(key)) {",
  "            current.glyphIndices.push(Math.max(0, current.glyphs.length - 1));",
  "            continue;",
  "        }",
  "        const glyph = source.glyphs[glyphIndex];",
  "        if (!glyph)",
  "            throw new TypeError(`textkit: no glyph for character ${index} of the line`);",
  "        drawn.set(key, true);",
  "        current.glyphIndices.push(current.glyphs.length);",
  "        current.glyphs.push(glyph);",
  "        current.positions.push(source.positions[glyphIndex]);",
  "    }",
  "    const updatedRuns = visualRuns.map((v) => ({",
  "        ...v.source,",
  "        start: v.start,",
  "        end: v.end,",
  "        glyphs: v.glyphs,",
  "        positions: v.positions,",
  "        glyphIndices: v.glyphIndices,",
  "    }));",
].join("\n");

/** Apply the patch to a textkit.js source string. Returns { status, source }. */
export function patchSource(src) {
  const text = src.replace(/\r\n/g, "\n");
  if (text.includes(MARKER)) return { status: "already-applied", source: src };
  if (!text.includes(ANCHOR)) return { status: "anchor-missing", source: src };
  return { status: "patched", source: text.replace(ANCHOR, REPLACEMENT) };
}

export function textkitFile(cwd = process.cwd()) {
  const require = createRequire(path.join(cwd, "package.json"));
  const pkgJson = require.resolve("@react-pdf/textkit/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
  return { file: path.join(path.dirname(pkgJson), "lib", "textkit.js"), version: pkg.version };
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { file, version } = textkitFile();
    const { status, source } = patchSource(fs.readFileSync(file, "utf8"));
    if (status === "patched") fs.writeFileSync(file, source);
    const note = status === "anchor-missing"
      ? `WARNING: @react-pdf/textkit ${version} does not contain the reorderLine block this patch targets; left unpatched (Arabic text layers will split inside words). Port scripts/patch-react-pdf-textkit.mjs.`
      : `@react-pdf/textkit ${version}: ${status}`;
    console.log(`[patch-react-pdf-textkit] ${note}`);
  } catch (err) {
    console.log(`[patch-react-pdf-textkit] WARNING: not applied (${err && err.message})`);
  }
}
