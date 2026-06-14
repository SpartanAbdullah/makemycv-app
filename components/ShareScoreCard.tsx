"use client";

import { useState } from "react";

/**
 * Brag-able score share card — renders "My CV scores N/100" to an
 * offscreen canvas and offers it through the native share sheet
 * (WhatsApp-first UAE audience), falling back to a PNG download.
 *
 * Privacy-compatible by construction: the image contains ONLY the score
 * number and the product URL — no CV content ever leaves the browser
 * (audit ENG-18). Reads the computeScore total; never touches the engine.
 */
export const ShareScoreCard = ({ total }: { total: number }) => {
  const [busy, setBusy] = useState(false);

  const buildPng = async (): Promise<Blob | null> => {
    const W = 1200;
    const H = 630;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Paper background + green accent bar, matching the Focus Flow system.
    ctx.fillStyle = "#FBFAF7";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0E7C4A";
    ctx.fillRect(0, 0, W, 14);

    ctx.fillStyle = "#6B7368";
    ctx.font = "600 34px Inter, Arial, sans-serif";
    ctx.fillText("My CV scores", 90, 200);

    ctx.fillStyle = "#0B0F0C";
    ctx.font = "700 170px Inter, Arial, sans-serif";
    const scoreText = `${total}`;
    ctx.fillText(scoreText, 90, 380);
    const scoreWidth = ctx.measureText(scoreText).width;
    ctx.fillStyle = "#6B7368";
    ctx.font = "600 60px Inter, Arial, sans-serif";
    ctx.fillText("/100", 90 + scoreWidth + 16, 380);

    ctx.fillStyle = "#0E7C4A";
    ctx.font = "600 36px Inter, Arial, sans-serif";
    ctx.fillText("UAE-ready CV · scored on the MakeMyCV rubric", 90, 480);

    ctx.fillStyle = "#6B7368";
    ctx.font = "500 32px Inter, Arial, sans-serif";
    ctx.fillText("Build yours free — makemycv.ae", 90, 545);

    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/png"),
    );
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await buildPng();
      if (!blob) return;
      const file = new File([blob], "makemycv-score.png", {
        type: "image/png",
      });
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: "My CV score",
            text: `My CV scores ${total}/100 on MakeMyCV — free UAE CV builder. makemycv.ae`,
          });
          return;
        } catch {
          /* share sheet dismissed — fall through to download */
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "makemycv-score.png";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      style={{
        background: "none",
        border: "none",
        padding: "6px 0",
        fontFamily: "var(--font-body)",
        fontSize: 12.5,
        color: "var(--ff-muted)",
        textDecoration: "underline",
        textUnderlineOffset: 3,
        cursor: busy ? "wait" : "pointer",
      }}
    >
      {busy ? "Preparing image…" : "Share your score (image only — never your CV)"}
    </button>
  );
};
