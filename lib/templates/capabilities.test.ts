import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { CvData } from "../types/cv";
import {
  TEMPLATES_WITHOUT_ACCENT,
  TEMPLATES_WITHOUT_DATE_OF_BIRTH,
  TEMPLATES_WITHOUT_PHOTO,
  describeOmittedDetails,
  getOmittedDetails,
  getTemplateCapabilities,
} from "./capabilities";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

/** Registry ids, read from the source because lib tests cannot import .tsx. */
const REGISTRY_SRC = read("lib", "templates", "index.tsx");
const REGISTRY_IDS = [
  ...REGISTRY_SRC.slice(REGISTRY_SRC.indexOf("export const templates")).matchAll(
    /^ {4}id: "([a-z-]+)",/gm,
  ),
].map((m) => m[1]);

/** The live template file behind each id (the two Professionals share one). */
const fileFor = (id: string) => (id === "professional-photo" ? "professional" : id);

/** Comments mention fields a template deliberately leaves out; code is what counts. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const templateCode = (id: string) =>
  stripComments(read("lib", "templates", `${fileFor(id)}.tsx`));

describe("template capabilities", () => {
  it("reads the registry", () => {
    assert.equal(REGISTRY_IDS.length, 14, `registry ids: ${REGISTRY_IDS.join(", ")}`);
    assert.ok(REGISTRY_IDS.includes("classic") && REGISTRY_IDS.includes("professional-photo"));
  });

  it("only names templates that exist", () => {
    for (const id of [
      ...TEMPLATES_WITHOUT_PHOTO,
      ...TEMPLATES_WITHOUT_DATE_OF_BIRTH,
      ...TEMPLATES_WITHOUT_ACCENT,
    ]) {
      assert.ok(REGISTRY_IDS.includes(id), `"${id}" is not a template id`);
    }
  });

  // The tripwires. If one fails, a template changed what it prints: update
  // the list in capabilities.ts (and the PDF layout — both must agree).
  it("date-of-birth list matches the template sources", () => {
    for (const id of REGISTRY_IDS) {
      const prints = /\bdateOfBirth\b/.test(templateCode(id));
      assert.equal(
        getTemplateCapabilities(id).printsDateOfBirth,
        prints,
        `${id}: the source ${prints ? "prints" : "does not print"} the date of birth`,
      );
    }
  });

  it("photo list matches the template sources", () => {
    const files = new Set(REGISTRY_IDS.map(fileFor));
    for (const file of files) {
      const ids = REGISTRY_IDS.filter((id) => fileFor(id) === file);
      const readsSwitch = /personal\.showPhoto\b/.test(templateCode(ids[0]));
      const anyPrints = ids.some((id) => getTemplateCapabilities(id).printsPhoto);
      assert.equal(
        anyPrints,
        readsSwitch,
        `${file}.tsx ${readsSwitch ? "reads" : "does not read"} the photo switch`,
      );
    }
    // The plain Professional variant passes showPhoto={false}.
    assert.match(read("lib", "templates", "professional.tsx"), /showPhoto=\{false\}/);
    assert.equal(getTemplateCapabilities("professional").printsPhoto, false);
    assert.equal(getTemplateCapabilities("professional-photo").printsPhoto, true);
  });

  it("every template that draws a photo also obeys the user's switch", () => {
    // Professional Photo printed the photo with the switch off (audit T7).
    for (const id of REGISTRY_IDS) {
      if (!getTemplateCapabilities(id).printsPhoto) continue;
      assert.match(templateCode(id), /personal\.showPhoto\b/, `${id} ignores "Show photo on CV"`);
    }
    const pdf = stripComments(read("components", "pdf", "CVDocument.tsx"));
    assert.doesNotMatch(
      pdf,
      /withPhoto && theme\.photoVisible/,
      "the Professional PDF layout must also check data.personal.showPhoto",
    );
  });

  it("accent list matches the template sources", () => {
    for (const id of REGISTRY_IDS) {
      // theme.accent, theme.accentText, a destructured `accent`, onAccent…
      const uses = /accent/i.test(templateCode(id));
      assert.equal(
        getTemplateCapabilities(id).usesAccent,
        uses,
        `${id}: the source ${uses ? "uses" : "does not use"} the accent colour`,
      );
    }
  });

  it("defaults to Classic when no template is stored", () => {
    assert.deepEqual(getTemplateCapabilities(undefined), getTemplateCapabilities("classic"));
  });
});

const cv = (
  personal: Partial<CvData["personal"]>,
  settings: Partial<CvData["settings"]> = {},
) =>
  ({ personal, settings } as unknown as Pick<CvData, "personal" | "settings">);

describe("getOmittedDetails", () => {
  const photoOn = { photo: "data:image/png;base64,AAAA", showPhoto: true };

  it("says nothing when the user has neither detail", () => {
    assert.deepEqual(getOmittedDetails("harvard", cv({})), []);
    assert.deepEqual(getOmittedDetails("onyx", cv({ dateOfBirth: "   " })), []);
  });

  it("says nothing on a template that prints both", () => {
    assert.deepEqual(
      getOmittedDetails("gulf-standard", cv({ ...photoOn, dateOfBirth: "12 Mar 1994" })),
      [],
    );
  });

  it("names the photo only when the user has switched it on", () => {
    assert.deepEqual(getOmittedDetails("harvard", cv(photoOn)), ["photo"]);
    assert.deepEqual(getOmittedDetails("professional", cv(photoOn)), ["photo"]);
    assert.deepEqual(getOmittedDetails("harvard", cv({ ...photoOn, showPhoto: false })), []);
    assert.deepEqual(getOmittedDetails("harvard", cv(photoOn, { photoShape: "hidden" })), []);
    assert.deepEqual(getOmittedDetails("professional-photo", cv(photoOn)), []);
  });

  it("names the date of birth on the four templates that leave it out", () => {
    for (const id of TEMPLATES_WITHOUT_DATE_OF_BIRTH) {
      assert.ok(
        getOmittedDetails(id, cv({ dateOfBirth: "12 Mar 1994" })).includes("dateOfBirth"),
        id,
      );
    }
    assert.deepEqual(getOmittedDetails("classic", cv({ dateOfBirth: "12 Mar 1994" })), []);
  });

  it("names both on Harvard", () => {
    assert.deepEqual(
      getOmittedDetails("harvard", cv({ ...photoOn, dateOfBirth: "12 Mar 1994" })),
      ["photo", "dateOfBirth"],
    );
  });
});

describe("describeOmittedDetails", () => {
  it("is silent when nothing is left out", () => {
    assert.equal(describeOmittedDetails("Classic", []), null);
  });

  it("writes one plain sentence per case", () => {
    assert.equal(
      describeOmittedDetails("Onyx", ["dateOfBirth"]),
      "The Onyx template does not print your date of birth. Pick another template if you want it on your CV.",
    );
    assert.equal(
      describeOmittedDetails("Harvard", ["photo", "dateOfBirth"]),
      "The Harvard template does not print your photo or your date of birth. Pick another template if you want them on your CV.",
    );
  });
});
