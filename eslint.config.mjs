import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  //
  // ESLint 9 flat config does NOT read .gitignore. Everything below IS
  // gitignored, but ESLint had no idea and was linting all of it: the run
  // reported 1,570 problems, of which ~1,530 came from a vendored 1.4 MB
  // pdf.js bundle and 19 directories of transient tsc output. That noise made
  // the ~40 real problems unreadable, which is most of why they accumulated.
  // (2026-08-02, audit A-W5-020.)
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored third-party bundle — not our code, and minified besides.
    // Shipped deliberately (see lib/importers/pdfAdapter.ts: self-hosted
    // worker first, cdnjs only as a fallback).
    "public/**",

    // Transient tsc output from the bespoke test scripts, one dir per suite.
    // A6 collapses these into a single .test-build/; the glob covers both
    // shapes so it keeps working either way.
    ".*-test-build/**",
    ".test-build/**",

    // Generated PDFs from scripts/pdf-smoke.tsx.
    ".smoke-pdfs/**",

    // Agent worktrees / scratch. Note the .gitignore entry intended to cover
    // this is corrupted (a UTF-16 fragment with a space between every
    // character, so it matches nothing) — see audit A-W5-053. Ignoring here
    // regardless, since ESLint would not have read .gitignore anyway.
    ".claude/**",
  ]),

  {
    // Node CLI scripts and .cjs test files are SUPPOSED to use require().
    // Flagging them was 6 false-positive errors, not a code problem.
    files: ["scripts/**/*.js", "scripts/**/*.cjs", "**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  {
    // components/pdf/** renders with @react-pdf/renderer, whose <Image> emits
    // a PDF drawing primitive — not a DOM <img>. alt text is meaningless
    // there and the rule does not apply. 9 false positives.
    files: ["components/pdf/**", "lib/templates/**"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
]);

export default eslintConfig;
