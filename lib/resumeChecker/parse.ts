// CV parsing pipeline for the /resume-checker flow.
//
//   rawText (extracted client-side via pdfAdapter.extractPdfTextInBrowser)
//        ↓
//   Claude Haiku → JSON (ParsedDocument shape + _parseSignals)
//        ↓
//   zod validate → mapParsedToCv → merge with defaultCvData → CvData
//        ↓
//   returns { cv, parseSignals, rawText }
//
// Server-only. Never import this file from a client component.
// PDF text extraction happens in the browser — see pdfAdapter.ts — to avoid
// the Next.js Turbopack + pdfjs worker incompatibility.

import {
  ANTHROPIC_PARSE_TIMEOUT_MS,
  PARSE_MAX_TOKENS,
  CLAUDE_EFFORT,
  CLAUDE_MODEL,
  anthropicSignal,
  isTimeoutError,
  responseText,
} from "../server/anthropic";
import type { CvData } from "../types/cv";
import type { ParsedDocument } from "../importers/adapter";
import { mapParsedToCv } from "../importers/fieldMapper";
import { defaultCvData } from "../store/cvStore";
import { parseTextToDocument } from "../importers/textParser";
import type { ParseSignals } from "./types";
import {
  PARSE_SYSTEM_PROMPT,
  buildParseUserPrompt,
  claudeResponseSchema,
  readSignals,
  stripNulls,
} from "./parseReply";

// The prompt, the example the model is shown and the schema its reply is held
// to live in parseReply.ts (pure, unit tested).

// --- Helpers ---

function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function emptySignals(
  confidence: ParseSignals["extractionConfidence"] = "medium",
): ParseSignals {
  return {
    hasTables: false,
    hasImages: false,
    hasUnusualFormatting: false,
    spellingIssues: [],
    extractionConfidence: confidence,
  };
}

// --- Claude call ---

async function callClaude(rawText: string): Promise<{
  parsed: ParsedDocument;
  signals: ParseSignals;
  usedFallback: boolean;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: PARSE_MAX_TOKENS,
      output_config: { effort: CLAUDE_EFFORT },
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildParseUserPrompt(rawText) }],
    }),
    // 45 s: the route's maxDuration is 60 and the report still has to be
    // scored and written to KV after the model answers.
    signal: anthropicSignal(ANTHROPIC_PARSE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown API error");
    throw new Error(`Anthropic API error: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const rawResponse = responseText(data);

  let jsonObj: unknown;
  try {
    jsonObj = extractJsonObject(rawResponse);
  } catch {
    // Hard fallback: heuristic text parser
    return {
      parsed: parseTextToDocument(rawText),
      signals: emptySignals("low"),
      usedFallback: true,
    };
  }

  // Nulls are removed before validation: every field in the schema is an
  // optional string, which accepts "missing" but not null, and one null used
  // to send an otherwise good reply down the soft fallback (2026-11-23).
  const withoutNulls = stripNulls(jsonObj);
  const validated = claudeResponseSchema.safeParse(withoutNulls);
  if (!validated.success) {
    // Soft fallback: keep whatever partial shape we got, fill the rest from heuristic
    const heuristic = parseTextToDocument(rawText);
    const loose = (withoutNulls ?? {}) as Record<string, unknown>;
    const parsed: ParsedDocument = {
      contact:
        (loose.contact as ParsedDocument["contact"]) ?? heuristic.contact,
      summary:
        typeof loose.summary === "string" ? loose.summary : heuristic.summary,
      experience: Array.isArray(loose.experience)
        ? (loose.experience as ParsedDocument["experience"])
        : heuristic.experience,
      education: Array.isArray(loose.education)
        ? (loose.education as ParsedDocument["education"])
        : heuristic.education,
      skills: Array.isArray(loose.skills)
        ? (loose.skills.filter((s) => typeof s === "string") as string[])
        : heuristic.skills,
      languages: Array.isArray(loose.languages)
        ? (loose.languages.filter((s) => typeof s === "string") as string[])
        : heuristic.languages,
      certifications: Array.isArray(loose.certifications)
        ? (loose.certifications as ParsedDocument["certifications"])
        : heuristic.certifications,
      // Never present in the Claude payload — always the heuristic's.
      uae: heuristic.uae,
      projects: heuristic.projects,
    };
    return {
      parsed,
      // The model's own layout and spelling findings survive when that part
      // of the reply is well formed; only a reply without them reads "low".
      signals: readSignals(loose._parseSignals) ?? emptySignals("low"),
      usedFallback: true,
    };
  }

  const v = validated.data;
  // The Claude tool schema has no `uae` / `projects` keys, so those were
  // dropped on this path even though the heuristic parser reliably harvests
  // them from labeled lines ("Visa Status: …", "Notice Period: …"). Once the
  // scoring engine started reading visa/availability/licence (A12–A14), that
  // omission made every checker report state "No visa status detected" on CVs
  // that say it in plain text. Backfill from the heuristic parse rather than
  // widening the Claude schema — these are regex-harvestable facts, and the
  // heuristic pass has already run for the fallback branches above.
  const heuristicForUae = parseTextToDocument(rawText);
  const parsed: ParsedDocument = {
    contact: v.contact,
    summary: v.summary,
    experience: v.experience,
    education: v.education,
    skills: v.skills,
    languages: v.languages,
    certifications: v.certifications,
    uae: heuristicForUae.uae,
    projects: heuristicForUae.projects,
  };
  const signals: ParseSignals = v._parseSignals ?? emptySignals("medium");

  return { parsed, signals, usedFallback: false };
}

// --- Public entry point ---

export type ParseError =
  | { kind: "too-short"; textLength: number }
  | { kind: "claude-failed"; message: string }
  /** The model did not answer within ANTHROPIC_PARSE_TIMEOUT_MS. */
  | { kind: "claude-timeout" };

export type ParseResult = {
  cv: CvData;
  parseSignals: ParseSignals;
  rawText: string;
  usedFallback: boolean;
};

/**
 * Parse pre-extracted CV text into a scored-ready CvData object.
 * Throws ParseError-shaped objects with `.kind`; callers should handle them as 4xx/5xx.
 */
export async function parseCvText(rawText: string): Promise<ParseResult> {
  if (rawText.length < 200) {
    const e: ParseError = { kind: "too-short", textLength: rawText.length };
    throw e;
  }

  let parsed: ParsedDocument;
  let signals: ParseSignals;
  let usedFallback = false;
  try {
    const out = await callClaude(rawText);
    parsed = out.parsed;
    signals = out.signals;
    usedFallback = out.usedFallback;
  } catch (err) {
    if (isTimeoutError(err)) {
      const e: ParseError = { kind: "claude-timeout" };
      throw e;
    }
    const message = err instanceof Error ? err.message : "Claude call failed";
    const e: ParseError = { kind: "claude-failed", message };
    throw e;
  }

  const partial = mapParsedToCv(parsed);
  const cv: CvData = {
    ...defaultCvData,
    ...partial,
    personal: { ...defaultCvData.personal, ...(partial.personal ?? {}) },
    experience:
      partial.experience && partial.experience.length > 0
        ? partial.experience
        : defaultCvData.experience,
    education:
      partial.education && partial.education.length > 0
        ? partial.education
        : defaultCvData.education,
    skills: partial.skills ?? defaultCvData.skills,
    languages: partial.languages ?? defaultCvData.languages,
    certifications: partial.certifications ?? defaultCvData.certifications,
    projects: partial.projects ?? defaultCvData.projects,
    settings: defaultCvData.settings,
  };

  return { cv, parseSignals: signals, rawText, usedFallback };
}
