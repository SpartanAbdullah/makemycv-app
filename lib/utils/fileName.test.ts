import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { coverLetterFileName, cvFileName, fileNamePart } from "./fileName";

describe("fileNamePart", () => {
  it("leaves a plain name alone and joins words with _", () => {
    assert.equal(fileNamePart("Amina"), "Amina");
    assert.equal(fileNamePart("  Mary   Jane "), "Mary_Jane");
    assert.equal(fileNamePart("Al-Mansoori"), "Al-Mansoori");
  });

  it("folds accented Latin letters to their base letter — none is lost", () => {
    assert.equal(fileNamePart("Renée"), "Renee");
    assert.equal(fileNamePart("Müller"), "Muller");
    assert.equal(fileNamePart("Nguyễn Thị"), "Nguyen_Thi");
    assert.equal(fileNamePart("Strauß"), "Strauss");
    assert.equal(fileNamePart("Søren Æbelø"), "Soren_AEbelo");
    assert.equal(fileNamePart("Łukasz Đorđević"), "Lukasz_Dordevic");
    assert.equal(fileNamePart("İpek Şahin Yıldız"), "Ipek_Sahin_Yildiz");
  });

  it("keeps names written in other scripts", () => {
    assert.equal(fileNamePart("محمد"), "محمد");
    assert.equal(fileNamePart("عبد الله"), "عبد_الله");
    assert.equal(fileNamePart("Дмитрий"), "Дмитрий");
    assert.equal(fileNamePart("प्रिया"), "प्रिया");
    assert.equal(fileNamePart("王小明"), "王小明");
  });

  it("keeps Arabic vowel marks attached to their letters", () => {
    const marked = "مُحَمَّد";
    assert.equal(fileNamePart(marked), marked.normalize("NFC"));
  });

  it("removes what a file name cannot carry", () => {
    assert.equal(fileNamePart('A/B\\C:D*E?F"G<H>I|J'), "ABCDEFGHIJ");
    assert.equal(fileNamePart("O'Brien"), "OBrien");
    assert.equal(fileNamePart("..hidden.."), "hidden");
    assert.equal(fileNamePart("__--Ali--__"), "Ali");
    // right-to-left override and zero-width joiner: invisible, used to
    // disguise file extensions
    assert.equal(fileNamePart("Ali‮fdp.exe"), "Alifdpexe");
    assert.equal(fileNamePart("A​li"), "Ali");
    assert.equal(fileNamePart("Dr. Sara (PMP)"), "Dr_Sara_PMP");
  });

  it("returns an empty string when nothing usable is left", () => {
    for (const v of ["", "   ", "---", "!!!", "🙂", undefined, null]) {
      assert.equal(fileNamePart(v), "", String(v));
    }
  });

  it("caps the length without leaving a trailing separator", () => {
    assert.equal(fileNamePart("abcde fghij", 6), "abcde");
    assert.equal(Array.from(fileNamePart("x".repeat(200))).length, 40);
    // astral characters are counted as one each
    assert.equal(Array.from(fileNamePart("𠮷".repeat(50), 10)).length, 10);
  });
});

describe("cvFileName", () => {
  it("names PDF, Word and backup the same way", () => {
    const p = { firstName: "Amina", lastName: "Khan" };
    assert.equal(cvFileName(p, "pdf"), "CV_Amina_Khan.pdf");
    assert.equal(cvFileName(p, "docx"), "CV_Amina_Khan.docx");
    assert.equal(cvFileName(p, "json"), "CV_Amina_Khan.json");
  });

  it("no longer drops accented letters (audit E4)", () => {
    assert.equal(
      cvFileName({ firstName: "Renée", lastName: "Müller" }, "pdf"),
      "CV_Renee_Muller.pdf",
    );
  });

  it("uses an Arabic name instead of the product's", () => {
    assert.equal(cvFileName({ firstName: "محمد", lastName: "علي" }, "pdf"), "CV_محمد_علي.pdf");
  });

  it("works with only one of the two names", () => {
    assert.equal(cvFileName({ firstName: "Amina" }, "pdf"), "CV_Amina.pdf");
    assert.equal(cvFileName({ firstName: "", lastName: "Khan" }, "pdf"), "CV_Khan.pdf");
  });

  it("falls back to what the file is, never to the product name", () => {
    assert.equal(cvFileName({}, "pdf"), "CV.pdf");
    assert.equal(cvFileName({ firstName: "!!!", lastName: " " }, "docx"), "CV.docx");
    assert.equal(cvFileName({}, "json", "CV_backup"), "CV_backup.json");
    assert.doesNotMatch(cvFileName({}, "pdf"), /makemycv/i);
  });
});

describe("coverLetterFileName", () => {
  it("puts the document type first, then the name, then the company", () => {
    assert.equal(
      coverLetterFileName({ firstName: "Amina", lastName: "Khan" }, "Emirates NBD"),
      "Cover_Letter_Amina_Khan_Emirates_NBD.docx",
    );
  });

  it("copes with a missing name or company", () => {
    assert.equal(coverLetterFileName({ firstName: "Amina" }, ""), "Cover_Letter_Amina.docx");
    assert.equal(coverLetterFileName({}, "ADNOC"), "Cover_Letter_ADNOC.docx");
    assert.equal(coverLetterFileName({}, undefined), "Cover_Letter.docx");
  });

  it("cleans the company the same way as the name", () => {
    assert.equal(
      coverLetterFileName({ firstName: "Zoë" }, "Al-Futtaim / Retail: HQ"),
      "Cover_Letter_Zoe_Al-Futtaim_Retail_HQ.docx",
    );
  });
});

describe("every export goes through it (source contract)", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

  it("no export builds its own file name", () => {
    for (const file of [
      ["hooks", "useDownloadCV.ts"],
      ["lib", "utils", "docxExport.ts"],
      ["lib", "coverLetter", "docx.ts"],
    ]) {
      const src = read(...file);
      assert.doesNotMatch(src, /a\.download\s*=/, `${file.join("/")} sets a.download itself`);
      assert.match(src, /triggerBlobDownload\(/, `${file.join("/")} must use triggerBlobDownload`);
    }
    assert.doesNotMatch(read("lib", "utils", "download.ts"), /CV_MakeMyCV"/);
  });
});
