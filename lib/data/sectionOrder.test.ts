/**
 * Guards domain-conditional section ordering (lib/data/sectionOrder.ts).
 * Built-in node:test + node:assert. Run via: npm run test:sectionorder
 */
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

import {
  DEFAULT_SECTION_ORDER,
  domainSectionOrder,
  isSkillsFirst,
} from "./sectionOrder";

describe("isSkillsFirst", () => {
  test("IT leads with skills", () => {
    assert.equal(isSkillsFirst("it"), true);
  });
  test("other domains + none do not", () => {
    assert.equal(isSkillsFirst("sales"), false);
    assert.equal(isSkillsFirst("engineering"), false); // construction = experience-first
    assert.equal(isSkillsFirst("healthcare"), false);
    assert.equal(isSkillsFirst(undefined), false);
  });
});

describe("domainSectionOrder", () => {
  test("default order for no domain / non-skills-first", () => {
    assert.deepEqual(domainSectionOrder(undefined), [...DEFAULT_SECTION_ORDER]);
    assert.deepEqual(domainSectionOrder("sales"), [...DEFAULT_SECTION_ORDER]);
  });

  test("IT hoists skills to directly after summary, above experience", () => {
    const order = domainSectionOrder("it");
    assert.equal(order[0], "summary");
    assert.equal(order[1], "skills");
    assert.ok(order.indexOf("skills") < order.indexOf("experience"));
    // No section dropped or duplicated.
    assert.equal(order.length, DEFAULT_SECTION_ORDER.length);
    assert.equal(new Set(order).size, order.length);
    for (const s of DEFAULT_SECTION_ORDER) assert.ok(order.includes(s));
  });

  test("returns a fresh array — mutation can't corrupt the default", () => {
    const order = domainSectionOrder("it");
    order.push("summary");
    assert.equal(DEFAULT_SECTION_ORDER.length, 7);
    assert.deepEqual(domainSectionOrder("sales"), [...DEFAULT_SECTION_ORDER]);
  });
});
