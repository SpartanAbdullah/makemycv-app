/**
 * Tests for JD-targeted ranking (lib/skills/suggest.ts) and the stored target
 * payload (lib/store/cvStore.ts parseStoredJdTarget).
 *
 * The point of the feature: relevance can only be resolved against a SPECIFIC
 * posting. A domain gets a candidate to a plausible SET; only the job ad
 * resolves the SELECTION. So when a job is targeted, its own words outrank our
 * curation — and the UI must say so rather than reshuffling silently.
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import { arrivalSuggestions, jdTermSet, searchSkills } from "./suggest";
import { parseStoredJdTarget } from "../store/cvStore";
import type { CvData } from "../types/cv";
import type { JdRequirements } from "../jdMatch/types";

function cvWith(partial: Partial<CvData>): CvData {
  return {
    personal: {
      firstName: "Fatima", lastName: "Noor", headline: "Procurement Officer",
      email: "", phone: "", location: "Sharjah", website: "", linkedin: "",
      summary: "Procurement officer with six years in construction sourcing.",
    },
    experience: [
      {
        id: "e1", company: "BuildCo", role: "Procurement Officer", location: "Sharjah",
        startDate: "2019", endDate: "", isCurrent: true,
        bullets: ["Negotiated AED 12M in annual supplier contracts."],
      },
    ],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    settings: { templateId: "classic" },
    ...partial,
  };
}

const reqs = (partial: Partial<JdRequirements>): JdRequirements => ({
  hardSkills: [], tools: [], certifications: [], softSkills: [], keywords: [],
  ...partial,
});

describe("jdTermSet", () => {
  test("flattens every category and normalises case", () => {
    const set = jdTermSet(
      reqs({
        jobTitle: "Buyer",
        hardSkills: ["  Customs Clearance "],
        tools: ["SAP MM"],
        certifications: ["CIPS / MCIPS"],
        softSkills: ["Negotiation"],
        keywords: ["Tendering"],
      }),
    );
    assert.ok(set.has("customs clearance"));
    assert.ok(set.has("sap mm"));
    assert.ok(set.has("cips / mcips"));
    assert.ok(set.has("negotiation"));
    assert.ok(set.has("tendering"));
  });

  test("null / empty requirements yield an empty set", () => {
    assert.equal(jdTermSet(null).size, 0);
    assert.equal(jdTermSet(undefined).size, 0);
    assert.equal(jdTermSet(reqs({})).size, 0);
  });
});

describe("arrival ranking against a targeted job", () => {
  const cv = cvWith({});

  test("a nice-tier skill the job names is promoted into the asked-for band", () => {
    const withoutJd = arrivalSuggestions(cv, "logistics", {});
    const before = withoutJd.alsoCommon.some((s) => s.name === "SAP MM");
    assert.ok(before, "SAP MM is nice-tier for logistics, so normally folded away");

    const withJd = arrivalSuggestions(cv, "logistics", {
      jd: reqs({ tools: ["SAP MM"] }),
    });
    assert.ok(
      withJd.usuallyAsked.some((s) => s.name === "SAP MM"),
      "a term the job asks for is promoted regardless of our tier",
    );
    assert.equal(withJd.alsoCommon.some((s) => s.name === "SAP MM"), false);
  });

  test("job-named terms sort ahead of merely must-tier ones", () => {
    const a = arrivalSuggestions(cv, "logistics", {
      jd: reqs({ tools: ["SAP MM"] }),
    });
    const first = a.usuallyAsked[0];
    assert.ok(first?.inJd, `expected a JD term first, got ${first?.name}`);
  });

  test("entries the job names carry the inJd flag", () => {
    const a = arrivalSuggestions(cv, "logistics", {
      jd: reqs({ hardSkills: ["Customs Clearance"] }),
    });
    const all = [...a.alreadyShown, ...a.usuallyAsked, ...a.alsoCommon];
    const cc = all.find((s) => s.name === "Customs Clearance");
    assert.ok(cc);
    assert.equal(cc.inJd, true);
  });

  test("an alias in the job ad still matches the canonical entry", () => {
    const a = arrivalSuggestions(cv, "engineering", {
      jd: reqs({ certifications: ["NEBOSH"] }),
    });
    const n = a.usuallyAsked.find((s) => s.name === "NEBOSH IGC");
    assert.ok(n, "the ad said NEBOSH; the bank calls it NEBOSH IGC");
    assert.equal(n.inJd, true);
  });

  test("a weak alias in the job ad does NOT match", () => {
    // A posting containing the ordinary word "node" is not asking for Node.js.
    const a = arrivalSuggestions(cv, "it", { jd: reqs({ keywords: ["node"] }) });
    const all = [...a.usuallyAsked, ...a.alsoCommon];
    const nodeEntry = all.find((s) => s.name === "Node.js");
    assert.ok(nodeEntry, "Node.js is still offered as a normal suggestion");
    assert.notEqual(nodeEntry.inJd, true, "but not as something this job asked for");
  });

  test("no target changes nothing — the domain bank behaves as before", () => {
    const withNull = arrivalSuggestions(cv, "logistics", { jd: null });
    const without = arrivalSuggestions(cv, "logistics", {});
    assert.deepEqual(
      withNull.usuallyAsked.map((s) => s.name),
      without.usuallyAsked.map((s) => s.name),
    );
  });

  test("a skill the CV already proves still outranks a JD hit", () => {
    // The user's own evidence is stronger than the posting's wording.
    const a = arrivalSuggestions(cv, "logistics", {
      jd: reqs({ hardSkills: ["Customs Clearance"] }),
    });
    const proven = cvWith({
      experience: [
        {
          id: "e1", company: "BuildCo", role: "Procurement Officer", location: "Sharjah",
          startDate: "2019", endDate: "", isCurrent: true,
          bullets: ["Handled customs clearance paperwork for inbound shipments."],
        },
      ],
    });
    const b = arrivalSuggestions(proven, "logistics", {
      jd: reqs({ hardSkills: ["Customs Clearance"] }),
    });
    assert.equal(a.alreadyShown.some((s) => s.name === "Customs Clearance"), false);
    assert.ok(
      b.alreadyShown.some((s) => s.name === "Customs Clearance"),
      "proof in the CV puts it in the already-shown band, not the asked-for band",
    );
  });
});

describe("search ranking against a targeted job", () => {
  const cv = cvWith({});

  test("a job-named term outranks an equally-matching one that is not", () => {
    const withJd = searchSkills("management", cv, "logistics", 8, reqs({ hardSkills: ["Vendor Management"] }));
    const idx = withJd.findIndex((r) => r.name === "Vendor Management");
    assert.ok(idx >= 0);
    assert.equal(withJd[0].name, "Vendor Management", "the job asked for it, so it leads");
    assert.equal(withJd[0].inJd, true);
  });

  test("passing no requirements leaves ranking unchanged", () => {
    const a = searchSkills("customs", cv, "logistics", 5);
    const b = searchSkills("customs", cv, "logistics", 5, null);
    assert.deepEqual(a.map((r) => r.name), b.map((r) => r.name));
  });
});

describe("parseStoredJdTarget", () => {
  const valid = {
    jobTitle: "Procurement Officer",
    capturedAt: 1_787_000_000_000,
    v: 1,
    requirements: reqs({ hardSkills: ["Customs Clearance"], tools: ["SAP MM"] }),
  };

  test("accepts a well-formed target", () => {
    const t = parseStoredJdTarget(JSON.stringify(valid));
    assert.ok(t);
    assert.equal(t.jobTitle, "Procurement Officer");
    assert.deepEqual(t.requirements.hardSkills, ["Customs Clearance"]);
    assert.equal(t.capturedAt, 1_787_000_000_000);
  });

  test("rejects a different shape version rather than guessing", () => {
    assert.equal(parseStoredJdTarget(JSON.stringify({ ...valid, v: 2 })), null);
    assert.equal(parseStoredJdTarget(JSON.stringify({ ...valid, v: undefined })), null);
  });

  test("rejects malformed and empty input without throwing", () => {
    for (const raw of [null, "", "{", "null", "[]", "42", '"str"']) {
      assert.equal(parseStoredJdTarget(raw as string | null), null, `should reject: ${raw}`);
    }
  });

  test("rejects a target with no requirements object", () => {
    assert.equal(parseStoredJdTarget(JSON.stringify({ v: 1, jobTitle: "X" })), null);
  });

  test("non-string entries inside a category are dropped, not trusted", () => {
    const t = parseStoredJdTarget(
      JSON.stringify({
        ...valid,
        requirements: { ...valid.requirements, tools: ["SAP MM", 42, null, { x: 1 }] },
      }),
    );
    assert.ok(t);
    assert.deepEqual(t.requirements.tools, ["SAP MM"]);
  });

  test("a missing category becomes an empty array, never undefined", () => {
    const t = parseStoredJdTarget(
      JSON.stringify({ v: 1, capturedAt: 1, requirements: { hardSkills: ["A"] } }),
    );
    assert.ok(t);
    assert.deepEqual(t.requirements.tools, []);
    assert.deepEqual(t.requirements.keywords, []);
    // and the parsed result is directly usable by the ranker
    assert.equal(jdTermSet(t.requirements).has("a"), true);
  });
});
