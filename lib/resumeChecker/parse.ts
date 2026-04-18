// CV parsing pipeline for the /resume-checker flow.
//
//   Buffer → pdfjs-dist (Node legacy build) → raw text
//        ↓
//   Claude Haiku → JSON (ParsedDocument shape + _parseSignals)
//        ↓
//   zod validate → mapParsedToCv → merge with defaultCvData → CvData
//        ↓
//   returns { cv, parseSignals, rawText }
//
// Server-only. Never import this file from a client component.

import { z } from "zod";
import type { CvData } from "../types/cv";
import type { ParsedDocument } from "../importers/adapter";
import { mapParsedToCv } from "../importers/fieldMapper";
import { defaultCvData } from "../store/cvStore";
import { parseTextToDocument } from "../importers/textParser";
import type { ParseSignals, SpellingIssue } from "./types";

// --- Zod schemas (mirror ParsedDocument, all fields optional) ---

const contactSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
  })
  .partial()
  .passthrough();

const experienceSchema = z
  .object({
    company: z.string().optional(),
    role: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    bullets: z.array(z.string()).optional(),
  })
  .partial()
  .passthrough();

const educationSchema = z
  .object({
    school: z.string().optional(),
    degree: z.string().optional(),
    field: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .partial()
  .passthrough();

const certificationSchema = z
  .object({
    name: z.string().optional(),
    issuer: z.string().optional(),
    date: z.string().optional(),
  })
  .partial()
  .passthrough();

const spellingIssueSchema = z.object({
  word: z.string(),
  context: z.string(),
  suggestion: z.string(),
});

const parseSignalsSchema = z.object({
  hasTables: z.boolean(),
  hasImages: z.boolean(),
  hasUnusualFormatting: z.boolean(),
  spellingIssues: z.array(spellingIssueSchema),
  extractionConfidence: z.enum(["high", "medium", "low"]),
});

const claudeResponseSchema = z
  .object({
    contact: contactSchema.optional(),
    summary: z.string().optional(),
    experience: z.array(experienceSchema).optional(),
    education: z.array(educationSchema).optional(),
    skills: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    certifications: z.array(certificationSchema).optional(),
    _parseSignals: parseSignalsSchema.optional(),
  })
  .passthrough();

// --- Example shown to Claude to anchor the output shape ---
// Mirrors the real ParsedDocument type. Must stay in sync with lib/importers/adapter.ts.
const EXAMPLE_OUTPUT = {
  contact: {
    name: "Aisha Khan",
    email: "aisha.khan@example.com",
    phone: "+971 50 123 4567",
    location: "Dubai, UAE",
    linkedin: "https://linkedin.com/in/aishakhan",
    website: "",
  },
  summary:
    "Senior Operations Manager with 8 years across logistics and retail in the UAE. Led cross-functional teams of 25+ and delivered 18% cost reduction in FY23.",
  experience: [
    {
      company: "Al Futtaim Logistics",
      role: "Operations Manager",
      location: "Dubai, UAE",
      startDate: "2021-03",
      endDate: "Present",
      isCurrent: true,
      bullets: [
        "Led a 25-person operations team across 3 distribution centres.",
        "Reduced last-mile delivery cost by 18% through route optimisation.",
        "Rolled out a new WMS, cutting order errors by 34%.",
      ],
    },
  ],
  education: [
    {
      school: "American University of Sharjah",
      degree: "BBA",
      field: "Operations Management",
      startDate: "2013-09",
      endDate: "2017-06",
      notes: "",
    },
  ],
  skills: ["Supply chain", "WMS", "Team leadership", "Excel (advanced)"],
  languages: ["English", "Arabic"],
  certifications: [
    { name: "Lean Six Sigma Green Belt", issuer: "ASQ", date: "2022-05" },
  ],
  _parseSignals: {
    hasTables: false,
    hasImages: false,
    hasUnusualFormatting: false,
    spellingIssues: [] as Array<SpellingIssue>,
    extractionConfidence: "high",
  },
};

const SYSTEM_PROMPT = `You are a CV parser. Extract structured data from raw CV text into the exact JSON schema provided.
Rules:
- Extract only what is explicitly in the text. Do not invent information.
- If a field is not present, return null or an empty array.
- Preserve exact wording of bullets and descriptions.
- Dates: convert to ISO format (YYYY-MM) where possible. If only a year is given, use YYYY-01.
- Detect if tables or columns appear garbled in the text (sign of ATS-unfriendly formatting).
- Return ONLY valid JSON. No prose, no markdown fences.`;

function buildUserPrompt(rawText: string): string {
  return `Extract this CV into the following schema:

${JSON.stringify(EXAMPLE_OUTPUT, null, 2)}

Additionally, include a "_parseSignals" object with these exact fields:
{
  "hasTables": boolean,              // text layout suggests table/column parsing
  "hasImages": boolean,              // layout suggests images were present
  "hasUnusualFormatting": boolean,   // non-standard characters, wide gaps, scrambled order
  "spellingIssues": [                // up to 10 suspected issues
    { "word": "string", "context": "nearby phrase", "suggestion": "string" }
  ],
  "extractionConfidence": "high" | "medium" | "low"
}

Raw CV text:
---
${rawText}
---

Return only the JSON object.`;
}

// --- Helpers ---

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
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

// --- PDF → text (pdfjs-dist legacy build, server-side) ---

export async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }
  return { text: fullText.trim(), pageCount: pdf.numPages };
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(rawText) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown API error");
    throw new Error(`Anthropic API error: ${res.status} — ${errText}`);
  }

  const data = await res.json();
  const rawResponse: string = data?.content?.[0]?.text ?? "";

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

  const validated = claudeResponseSchema.safeParse(jsonObj);
  if (!validated.success) {
    // Soft fallback: keep whatever partial shape we got, fill the rest from heuristic
    const heuristic = parseTextToDocument(rawText);
    const loose = jsonObj as Record<string, unknown>;
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
    };
    return {
      parsed,
      signals: emptySignals("low"),
      usedFallback: true,
    };
  }

  const v = validated.data;
  const parsed: ParsedDocument = {
    contact: v.contact,
    summary: v.summary,
    experience: v.experience,
    education: v.education,
    skills: v.skills,
    languages: v.languages,
    certifications: v.certifications,
  };
  const signals: ParseSignals = v._parseSignals ?? emptySignals("medium");

  return { parsed, signals, usedFallback: false };
}

// --- Public entry point ---

export type ParseError =
  | { kind: "too-short"; textLength: number }
  | { kind: "pdf-failed"; message: string }
  | { kind: "claude-failed"; message: string };

export type ParseResult = {
  cv: CvData;
  parseSignals: ParseSignals;
  rawText: string;
  usedFallback: boolean;
};

/**
 * Parse a PDF buffer into a scored-ready CvData object.
 * Throws ParseError-shaped objects with `.kind`; callers should handle them as 4xx/5xx.
 */
export async function parseCvPdf(buffer: Buffer): Promise<ParseResult> {
  let rawText = "";
  try {
    const { text } = await extractPdfText(buffer);
    rawText = text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF parse failed";
    const e: ParseError = { kind: "pdf-failed", message };
    throw e;
  }

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
