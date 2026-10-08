import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clampRoiSettings, computeRoi, ROI_DEFAULTS, storedRoiSettings, type RoiInput } from "@/lib/roi";

const none: RoiInput = { applications: 0, hires: 0, interviews: 0, messages: 0, replacedAds: 0, agencyHires: 0 };

describe("Spart med Vis", () => {
  test("eksempelet fra kostnadsgrunnlaget: 3 annonser, 280 søknader, 2 ansettelser, 1 uten byrå", () => {
    const roi = computeRoi({ ...none, applications: 280, hires: 2, replacedAds: 3, agencyHires: 1 });
    // 280 · 1,5/60 + 2 · 10 = 7 + 20 = 27 t
    assert.equal(roi.hours, 27);
    // 3 · 14 400 + 27 · 650 = 43 200 + 17 550 = 60 750 → ca. 60 000
    assert.equal(roi.kroner, 60_000);
    // 650 000 · 15 % = 97 500 → ca. 97 000, vist for seg
    assert.equal(roi.agency, 97_000);
  });

  test("timer = A·1,5/60 + H·10 + B·0,5 + M·2/60, og hver del vises for seg", () => {
    const roi = computeRoi({ ...none, applications: 40, hires: 1, interviews: 6, messages: 30 });
    // 1 + 10 + 3 + 1 = 15 t (30 · 2/60 = 1 skal ikke bli 0,999… og rundes ned)
    assert.equal(roi.hours, 15);
    assert.equal(roi.kroner, 9_000); // 15 · 650 = 9 750 → 9 000
    const part = Object.fromEntries(roi.parts.map((p) => [p.key, p]));
    assert.equal(part.applications.hours, 1);
    assert.equal(part.hires.hours, 10);
    assert.equal(part.interviews.hours, 3);
    assert.equal(Math.round(part.messages.hours * 1000) / 1000, 1);
    assert.equal(part.ads.kroner, 0);
    assert.equal(part.interviews.kroner, 3 * 650);
  });

  test("rundes alltid ned: kroner til nærmeste 1 000 og timer til hele timer", () => {
    const roi = computeRoi({ ...none, applications: 79 }); // 1,975 t · 650 = 1 283,75 kr
    assert.equal(roi.hours, 1);
    assert.equal(roi.kroner, 1_000);
    assert.equal(computeRoi({ ...none, applications: 39 }).kroner, 0); // 633,75 kr → 0
    assert.equal(computeRoi({ ...none, applications: 39 }).hours, 0);
  });

  test("annonser og byrå telles bare når bedriften har krysset av", () => {
    const busy = computeRoi({ ...none, applications: 500, hires: 4 });
    assert.equal(busy.agency, 0);
    assert.equal(busy.parts.find((p) => p.key === "ads")?.kroner, 0);
    // Byrå kan ikke unngås for flere enn dem som faktisk er ansatt.
    assert.equal(computeRoi({ ...none, hires: 1, agencyHires: 5 }).agency, 97_000);
    assert.equal(computeRoi({ ...none, agencyHires: 3 }).agency, 0);
    // Byråsummen er aldri med i hovedtallet.
    assert.equal(computeRoi({ ...none, hires: 1, agencyHires: 1 }).kroner, computeRoi({ ...none, hires: 1 }).kroner);
  });

  test("ugyldige tall blir 0, og ingenting gir 0", () => {
    const roi = computeRoi({ applications: -5, hires: Number.NaN, interviews: 2.9, messages: "x" as unknown as number, replacedAds: Infinity, agencyHires: -1 });
    assert.equal(roi.hours, 1); // bare 2 intervjuer (2,9 → 2)
    assert.equal(computeRoi(none).kroner, 0);
    assert.equal(computeRoi(none).multiple, null);
  });

  test("ganger abonnementsprisen: én desimal, rundet ned, bare med en pris", () => {
    assert.equal(computeRoi({ ...none, replacedAds: 1, subscriptionCost: 4_470 }).multiple, 3.1); // 14 000 / 4 470 = 3,13
    assert.equal(computeRoi({ ...none, replacedAds: 1, subscriptionCost: 0 }).multiple, null);
    assert.equal(computeRoi({ ...none, replacedAds: 1 }).multiple, null);
  });

  test("egne tall brukes i utregningen", () => {
    const roi = computeRoi({ ...none, hires: 1, agencyHires: 1, replacedAds: 1 }, { hourlyCost: 1000, salary: 800_000, agencyFee: 0.2, adPrice: 10_000 });
    assert.equal(roi.kroner, 20_000); // 10 000 + 10 t · 1 000
    assert.equal(roi.agency, 160_000);
  });
});

describe("egne tall i «Slik regner vi»", () => {
  test("mangler noe, brukes standarden", () => {
    assert.deepEqual(clampRoiSettings(null), ROI_DEFAULTS);
    assert.deepEqual(clampRoiSettings({ hourlyCost: 900 }), { ...ROI_DEFAULTS, hourlyCost: 900 });
    assert.deepEqual(clampRoiSettings({ hourlyCost: "", salary: null, adPrice: "abc" }), ROI_DEFAULTS);
  });

  test("tall holdes innenfor grensene", () => {
    const s = clampRoiSettings({ hourlyCost: 1e9, salary: 10, agencyFee: 0.9, adPrice: -100 });
    assert.equal(s.hourlyCost, 3_000);
    assert.equal(s.salary, 200_000);
    assert.equal(s.agencyFee, 0.4);
    assert.equal(s.adPrice, 0);
  });

  test("byråhonorar kan skrives som prosent eller andel, og tekst med mellomrom og komma tåles", () => {
    assert.equal(clampRoiSettings({ agencyFee: 20 }).agencyFee, 0.2);
    assert.equal(clampRoiSettings({ agencyFee: "12,5" }).agencyFee, 0.125);
    assert.equal(clampRoiSettings({ salary: "700 000" }).salary, 700_000);
    assert.equal(clampRoiSettings({ hourlyCost: 712.6 }).hourlyCost, 713);
  });

  test("bare det som avviker fra standarden lagres", () => {
    assert.equal(storedRoiSettings({}), null);
    assert.equal(storedRoiSettings(ROI_DEFAULTS), null);
    assert.deepEqual(storedRoiSettings({ hourlyCost: 800, salary: 650_000, extra: "x" }), { hourlyCost: 800 });
  });
});
