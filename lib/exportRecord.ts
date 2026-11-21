/**
 * Recording a CV download — the one place that does it (product audit
 * 2026-11, E5).
 *
 * `cv_export` is the number the product is judged on. It used to be fired
 * inline in BuilderShell, and JD Match's "Download for this job" — the
 * download made by the most engaged users — exported the same file without
 * the event, without the attempt counter and without the post-download card.
 * Both now call these two functions, so a download cannot be counted one way
 * in one place and another way (or not at all) somewhere else.
 * `exportAsks.test.ts` fails if a download path fires the event itself.
 *
 * A JSON backup is housekeeping, not a finished CV: never record it here.
 */
import { track } from "./analytics";
import { HUMAN_REVIEW_ON } from "./config/humanReview";
import {
  nextExportNumber,
  resolveExportAsk,
  sentenceForExport,
  type AnswerableAsk,
  type ExportAsk,
  type ExportSentence,
} from "./exportAsks";

export type CvExportFormat = "pdf" | "docx";

/**
 * Attempt counter for the export funnel: cv_export_started → cv_export. The
 * gap between the two is the render-failure rate. Call it before rendering.
 */
export function recordCvExportStarted(format: CvExportFormat, templateId: string): void {
  track("cv_export_started", { format, template: templateId });
}

/**
 * Call it once the file exists — after the await, so it counts exports that
 * produced a file, not clicks and not attempts that threw. Returns what the
 * post-download card should show for this export; decided once, here, so
 * answering a star mid-card cannot swap the row out from under the thanks
 * line.
 *
 * No `plan` parameter: every call site passes "pro", so it would be a
 * constant masquerading as a dimension. Add it when a real free/pro split
 * exists.
 */
export function recordCvExport(
  format: CvExportFormat,
  templateId: string,
  canAsk: (ask: AnswerableAsk) => boolean,
): { ask: ExportAsk; sentence: ExportSentence } {
  track("cv_export", { format, template: templateId });
  const exportNumber = nextExportNumber();
  return {
    ask: resolveExportAsk(exportNumber, canAsk),
    sentence: sentenceForExport(exportNumber, HUMAN_REVIEW_ON),
  };
}
