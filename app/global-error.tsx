"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/* Last-resort boundary (audit 2026-06-12, gap #2). Replaces the ROOT
 * layout when it crashes, so it must render its own <html>/<body> and
 * CANNOT rely on globals.css or next/font — every style is inline with
 * hardcoded Focus Flow hex values (paper #FBFAF7, ink #0B0F0C,
 * UAE green #0E7C4A). Keep this file dependency-free.
 *
 * ONE DELIBERATE EXCEPTION (2026-08-02): @sentry/nextjs. The rule above is
 * about RENDERING — this file must not depend on anything that could itself be
 * broken when the root layout has already failed, because then the user sees a
 * blank page instead of an apology. Sentry is imported for reporting only and
 * is never on the render path: if the capture throws, the JSX below still
 * renders. And this is precisely the boundary whose errors you most need to
 * see, since reaching it means the whole app failed to mount. Do not add any
 * other import here. */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
    // Reporting only — never on the render path. See the header note.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FBFAF7",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            background: "#FFFFFF",
            border: "1px solid #E6E4DD",
            borderRadius: "18px",
            boxShadow: "0 14px 36px rgba(11, 15, 12, 0.10)",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              width: "48px",
              height: "48px",
              margin: "0 auto",
              borderRadius: "999px",
              background: "#FFF5E0",
              color: "#A26500",
              fontSize: "24px",
              lineHeight: "48px",
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: "20px",
              fontWeight: 600,
              color: "#0B0F0C",
            }}
          >
            MakeMyCV hit an unexpected error
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#6B7368",
            }}
          >
            Your CV data is saved in this browser and is not lost. Reloading
            the page usually fixes this.
          </p>
          <a
            href="/builder"
            style={{
              display: "inline-block",
              marginTop: "24px",
              padding: "10px 22px",
              borderRadius: "999px",
              background: "#0E7C4A",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Reload MakeMyCV
          </a>
          <p style={{ margin: "24px 0 0", fontSize: "12px", color: "#A6ADA4" }}>
            Still stuck? Email{" "}
            <a href="mailto:hello@makemycv.ae" style={{ color: "#6B7368" }}>
              hello@makemycv.ae
            </a>
            {error.digest ? ` — code ${error.digest}` : ""}.
          </p>
        </div>
      </body>
    </html>
  );
}
