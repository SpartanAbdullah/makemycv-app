/**
 * Consent Mode update (product audit 2026-11, P1).
 *
 * GTM treats an `arguments` object on the dataLayer as a command and a plain
 * Array as data. writeConsent() pushed an Array until 2026-11-21, so a
 * visitor's "Opt out" changed nothing until the next full page load. These
 * tests pin the shape, because the two look identical when logged.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { CONSENT_DEFAULT_SCRIPT, geoBucket, writeConsent } from "./consent";

type Globals = { window?: unknown; document?: unknown; location?: unknown };
const g = globalThis as Globals;
const saved: Globals = {};

const isArguments = (v: unknown) => Object.prototype.toString.call(v) === "[object Arguments]";

describe("writeConsent", () => {
  let dataLayer: unknown[];
  let cookieWrites: string[];

  beforeEach(() => {
    saved.window = g.window;
    saved.document = g.document;
    saved.location = g.location;
    dataLayer = [];
    cookieWrites = [];
    g.window = { dataLayer };
    g.location = { protocol: "https:", hostname: "app.makemycv.ae" };
    g.document = {
      get cookie() {
        return "_ga=GA1.1.1; _ga_ABC=GS1.1; other=1";
      },
      set cookie(v: string) {
        cookieWrites.push(v);
      },
    };
  });

  afterEach(() => {
    g.window = saved.window;
    g.document = saved.document;
    g.location = saved.location;
  });

  for (const choice of ["granted", "denied"] as const) {
    it(`pushes "${choice}" as an arguments object, not an Array`, () => {
      writeConsent(choice);
      assert.equal(dataLayer.length, 1);
      const command = dataLayer[0] as ArrayLike<unknown>;
      assert.equal(Array.isArray(command), false, "a plain Array is ignored by GTM");
      assert.equal(isArguments(command), true);
      assert.equal(command.length, 3);
      assert.equal(command[0], "consent");
      assert.equal(command[1], "update");
      assert.deepEqual(command[2], { analytics_storage: choice });
    });
  }

  it("stores the choice for a year on the shared domain", () => {
    writeConsent("granted");
    const write = cookieWrites.find((c) => c.startsWith("mmcv_consent=granted"));
    assert.ok(write, cookieWrites.join(" | "));
    assert.match(write, /Max-Age=31536000/);
    assert.match(write, /Domain=\.makemycv\.ae/);
    assert.match(write, /Secure/);
  });

  it("removes the GA cookies on decline and leaves others alone", () => {
    writeConsent("denied");
    assert.ok(cookieWrites.some((c) => c.startsWith("_ga=;") && c.includes("Max-Age=0")));
    assert.ok(cookieWrites.some((c) => c.startsWith("_ga_ABC=;") && c.includes("Max-Age=0")));
    assert.equal(cookieWrites.some((c) => c.startsWith("other=")), false);
  });

  it("creates the dataLayer when GTM has not loaded yet", () => {
    g.window = {};
    writeConsent("denied");
    const layer = (g.window as { dataLayer?: unknown[] }).dataLayer;
    assert.ok(Array.isArray(layer) && layer.length === 1);
    assert.equal(isArguments(layer[0]), true);
  });
});

describe("consent defaults", () => {
  it("the inline default also pushes an arguments object", () => {
    assert.match(CONSENT_DEFAULT_SCRIPT, /function push\(\)\{window\.dataLayer\.push\(arguments\);\}/);
    assert.match(CONSENT_DEFAULT_SCRIPT, /push\('consent','default',/);
  });

  it("buckets EEA, UK and Switzerland as eu", () => {
    assert.equal(geoBucket("DE"), "eu");
    assert.equal(geoBucket("gb"), "eu");
    assert.equal(geoBucket("CH"), "eu");
    assert.equal(geoBucket("AE"), "row");
    assert.equal(geoBucket("IN"), "row");
    assert.equal(geoBucket(null), "row");
  });

  it("no rest-parameter Array is pushed anywhere in the module (source contract)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib", "consent.ts"), "utf8");
    assert.doesNotMatch(src, /dataLayer!?\.push\(args\b/);
    assert.match(src, /dataLayer\.push\(arguments as unknown/);
  });
});
